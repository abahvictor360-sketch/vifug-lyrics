#include "filter.h"

#include <initguid.h>
#include <algorithm>
#include <new>

// Generated once for Vifug. See the note in filter.h: this must never change.
DEFINE_GUID(CLSID_VifugCamera,
            0x7e3f1a52, 0x9c4d, 0x4b86, 0x9f, 0x1c, 0x2a, 0x5d, 0x8e, 0x0b, 0x7c, 0x31);

namespace {

// The sizes offered to the host. A host picks one of these, we pass it back to
// Vifug, and Vifug renders at exactly that size - so this list is really a
// list of render targets, not of things to scale between.
struct Size { int w, h; };
const Size kSizes[] = {
    {1920, 1080}, {1600, 900}, {1280, 720}, {1024, 576}, {854, 480}, {640, 360},
};
const int kSizeCount = static_cast<int>(sizeof(kSizes) / sizeof(kSizes[0]));

const REFERENCE_TIME kFrameTime30 = 333333;  // 100ns units
const REFERENCE_TIME kMinFrameTime = 166666; // 60fps
const REFERENCE_TIME kMaxFrameTime = 1000000;// 10fps

// Vifug's own surface and accent colours, for the frame shown when the app is
// not publishing. Black alone is indistinguishable from a broken camera.
const BYTE kIdleB = 0x14, kIdleG = 0x0E, kIdleR = 0x0B;
const BYTE kBarB = 0x35, kBarG = 0xE6, kBarR = 0xA3;

void FreeMediaTypeContents(AM_MEDIA_TYPE* mt) {
  if (!mt) return;
  if (mt->cbFormat && mt->pbFormat) {
    CoTaskMemFree(mt->pbFormat);
    mt->pbFormat = nullptr;
    mt->cbFormat = 0;
  }
  if (mt->pUnk) {
    mt->pUnk->Release();
    mt->pUnk = nullptr;
  }
}

HRESULT CopyMediaType(AM_MEDIA_TYPE* dst, const AM_MEDIA_TYPE* src) {
  *dst = *src;
  dst->pbFormat = nullptr;
  dst->pUnk = nullptr;
  if (src->cbFormat && src->pbFormat) {
    dst->pbFormat = static_cast<BYTE*>(CoTaskMemAlloc(src->cbFormat));
    if (!dst->pbFormat) return E_OUTOFMEMORY;
    memcpy(dst->pbFormat, src->pbFormat, src->cbFormat);
  }
  if (src->pUnk) {
    dst->pUnk = src->pUnk;
    dst->pUnk->AddRef();
  }
  return S_OK;
}

// RGB32, top-left origin on the wire but bottom-up in the buffer, which is
// what a positive biHeight means to every DirectShow consumer.
HRESULT BuildMediaType(AM_MEDIA_TYPE* mt, int width, int height, REFERENCE_TIME frameTime) {
  ZeroMemory(mt, sizeof(*mt));
  VIDEOINFOHEADER* vih = static_cast<VIDEOINFOHEADER*>(CoTaskMemAlloc(sizeof(VIDEOINFOHEADER)));
  if (!vih) return E_OUTOFMEMORY;
  ZeroMemory(vih, sizeof(*vih));

  vih->bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  vih->bmiHeader.biWidth = width;
  vih->bmiHeader.biHeight = height;
  vih->bmiHeader.biPlanes = 1;
  vih->bmiHeader.biBitCount = 32;
  vih->bmiHeader.biCompression = BI_RGB;
  vih->bmiHeader.biSizeImage = static_cast<DWORD>(width) * height * 4;
  vih->AvgTimePerFrame = frameTime;
  vih->dwBitRate = static_cast<DWORD>(vih->bmiHeader.biSizeImage * 8.0 * (10000000.0 / frameTime));

  mt->majortype = MEDIATYPE_Video;
  mt->subtype = MEDIASUBTYPE_RGB32;
  mt->formattype = FORMAT_VideoInfo;
  mt->bFixedSizeSamples = TRUE;
  mt->bTemporalCompression = FALSE;
  mt->lSampleSize = vih->bmiHeader.biSizeImage;
  mt->cbFormat = sizeof(VIDEOINFOHEADER);
  mt->pbFormat = reinterpret_cast<BYTE*>(vih);
  return S_OK;
}

const VIDEOINFOHEADER* AsVideoInfo(const AM_MEDIA_TYPE* mt) {
  if (!mt || mt->formattype != FORMAT_VideoInfo) return nullptr;
  if (!mt->pbFormat || mt->cbFormat < sizeof(VIDEOINFOHEADER)) return nullptr;
  return reinterpret_cast<const VIDEOINFOHEADER*>(mt->pbFormat);
}

bool AcceptableType(const AM_MEDIA_TYPE* mt) {
  if (!mt) return false;
  if (mt->majortype != MEDIATYPE_Video) return false;
  if (mt->subtype != MEDIASUBTYPE_RGB32) return false;
  const VIDEOINFOHEADER* vih = AsVideoInfo(mt);
  if (!vih) return false;
  if (vih->bmiHeader.biBitCount != 32) return false;
  if (vih->bmiHeader.biCompression != BI_RGB) return false;
  const LONG w = vih->bmiHeader.biWidth;
  const LONG h = labs(vih->bmiHeader.biHeight);
  return w >= 64 && w <= 7680 && h >= 64 && h <= 4320;
}

// ---------------------------------------------------------------- enumerators

class VifugEnumPins : public IEnumPins {
 public:
  VifugEnumPins(IPin* pin, ULONG at) : pin_(pin), at_(at) { pin_->AddRef(); }
  virtual ~VifugEnumPins() { pin_->Release(); }

  STDMETHODIMP QueryInterface(REFIID riid, void** ppv) override {
    if (!ppv) return E_POINTER;
    if (riid == IID_IUnknown || riid == IID_IEnumPins) {
      *ppv = static_cast<IEnumPins*>(this);
      AddRef();
      return S_OK;
    }
    *ppv = nullptr;
    return E_NOINTERFACE;
  }
  STDMETHODIMP_(ULONG) AddRef() override { return InterlockedIncrement(&refs_); }
  STDMETHODIMP_(ULONG) Release() override {
    LONG n = InterlockedDecrement(&refs_);
    if (n == 0) delete this;
    return n;
  }

  STDMETHODIMP Next(ULONG want, IPin** out, ULONG* got) override {
    if (!out) return E_POINTER;
    if (want != 1 && !got) return E_INVALIDARG;
    ULONG n = 0;
    while (n < want && at_ < 1) {
      pin_->AddRef();
      out[n++] = pin_;
      at_++;
    }
    if (got) *got = n;
    return n == want ? S_OK : S_FALSE;
  }
  STDMETHODIMP Skip(ULONG n) override {
    at_ += n;
    return at_ > 1 ? S_FALSE : S_OK;
  }
  STDMETHODIMP Reset() override {
    at_ = 0;
    return S_OK;
  }
  STDMETHODIMP Clone(IEnumPins** out) override {
    if (!out) return E_POINTER;
    *out = new (std::nothrow) VifugEnumPins(pin_, at_);
    return *out ? S_OK : E_OUTOFMEMORY;
  }

 private:
  LONG refs_ = 1;
  IPin* pin_;
  ULONG at_;
};

class VifugEnumMediaTypes : public IEnumMediaTypes {
 public:
  explicit VifugEnumMediaTypes(ULONG at) : at_(at) {}
  virtual ~VifugEnumMediaTypes() = default;

  STDMETHODIMP QueryInterface(REFIID riid, void** ppv) override {
    if (!ppv) return E_POINTER;
    if (riid == IID_IUnknown || riid == IID_IEnumMediaTypes) {
      *ppv = static_cast<IEnumMediaTypes*>(this);
      AddRef();
      return S_OK;
    }
    *ppv = nullptr;
    return E_NOINTERFACE;
  }
  STDMETHODIMP_(ULONG) AddRef() override { return InterlockedIncrement(&refs_); }
  STDMETHODIMP_(ULONG) Release() override {
    LONG n = InterlockedDecrement(&refs_);
    if (n == 0) delete this;
    return n;
  }

  STDMETHODIMP Next(ULONG want, AM_MEDIA_TYPE** out, ULONG* got) override {
    if (!out) return E_POINTER;
    if (want != 1 && !got) return E_INVALIDARG;
    ULONG n = 0;
    while (n < want && at_ < static_cast<ULONG>(kSizeCount)) {
      AM_MEDIA_TYPE* mt = static_cast<AM_MEDIA_TYPE*>(CoTaskMemAlloc(sizeof(AM_MEDIA_TYPE)));
      if (!mt) break;
      if (FAILED(BuildMediaType(mt, kSizes[at_].w, kSizes[at_].h, kFrameTime30))) {
        CoTaskMemFree(mt);
        break;
      }
      out[n++] = mt;
      at_++;
    }
    if (got) *got = n;
    return n == want ? S_OK : S_FALSE;
  }
  STDMETHODIMP Skip(ULONG n) override {
    at_ += n;
    return at_ > static_cast<ULONG>(kSizeCount) ? S_FALSE : S_OK;
  }
  STDMETHODIMP Reset() override {
    at_ = 0;
    return S_OK;
  }
  STDMETHODIMP Clone(IEnumMediaTypes** out) override {
    if (!out) return E_POINTER;
    *out = new (std::nothrow) VifugEnumMediaTypes(at_);
    return *out ? S_OK : E_OUTOFMEMORY;
  }

 private:
  LONG refs_ = 1;
  ULONG at_;
};

}  // namespace

// --------------------------------------------------------------------- pin

VifugPin::VifugPin(VifugFilter* owner) : owner_(owner) {
  // 720p is the default a host gets if it connects without choosing: the size
  // most church streams are mixed at, and cheap enough to render everywhere.
  BuildMediaType(&current_, 1280, 720, kFrameTime30);
}

VifugPin::~VifugPin() {
  Deactivate();
  Disconnect();
  FreeMediaTypeContents(&current_);
}

STDMETHODIMP VifugPin::QueryInterface(REFIID riid, void** ppv) {
  if (!ppv) return E_POINTER;
  if (riid == IID_IUnknown || riid == IID_IPin) {
    *ppv = static_cast<IPin*>(this);
  } else if (riid == IID_IAMStreamConfig) {
    *ppv = static_cast<IAMStreamConfig*>(this);
  } else if (riid == IID_IKsPropertySet) {
    *ppv = static_cast<IKsPropertySet*>(this);
  } else if (riid == IID_IQualityControl) {
    *ppv = static_cast<IQualityControl*>(this);
  } else {
    *ppv = nullptr;
    return E_NOINTERFACE;
  }
  AddRef();
  return S_OK;
}

// The pin's lifetime is the filter's: a host that holds a pin and drops the
// filter must not be left with a dangling object, so the counts are shared.
STDMETHODIMP_(ULONG) VifugPin::AddRef() { return owner_->AddRef(); }
STDMETHODIMP_(ULONG) VifugPin::Release() { return owner_->Release(); }

STDMETHODIMP VifugPin::Connect(IPin* receive, const AM_MEDIA_TYPE* mt) {
  if (!receive) return E_POINTER;
  if (peer_) return VFW_E_ALREADY_CONNECTED;
  if (owner_->State() != State_Stopped) return VFW_E_NOT_STOPPED;

  // A fully specified type from the host wins. A partial one (or none) means
  // "you choose", and we offer what we are already set to before the rest.
  AM_MEDIA_TYPE chosen{};
  bool haveChosen = false;

  if (mt && AcceptableType(mt)) {
    if (FAILED(CopyMediaType(&chosen, mt))) return E_OUTOFMEMORY;
    haveChosen = true;
  }

  HRESULT hr = VFW_E_NO_ACCEPTABLE_TYPES;
  if (haveChosen) {
    hr = receive->ReceiveConnection(this, &chosen);
    if (FAILED(hr)) FreeMediaTypeContents(&chosen);
  } else {
    AM_MEDIA_TYPE candidate{};
    if (SUCCEEDED(CopyMediaType(&candidate, &current_))) {
      hr = receive->ReceiveConnection(this, &candidate);
      if (SUCCEEDED(hr)) {
        chosen = candidate;
        haveChosen = true;
      } else {
        FreeMediaTypeContents(&candidate);
      }
    }
    for (int i = 0; !haveChosen && i < kSizeCount; i++) {
      AM_MEDIA_TYPE next{};
      if (FAILED(BuildMediaType(&next, kSizes[i].w, kSizes[i].h, kFrameTime30))) continue;
      hr = receive->ReceiveConnection(this, &next);
      if (SUCCEEDED(hr)) {
        chosen = next;
        haveChosen = true;
      } else {
        FreeMediaTypeContents(&next);
      }
    }
  }
  if (!haveChosen) return FAILED(hr) ? hr : VFW_E_NO_ACCEPTABLE_TYPES;

  IMemInputPin* input = nullptr;
  hr = receive->QueryInterface(IID_IMemInputPin, reinterpret_cast<void**>(&input));
  if (FAILED(hr)) {
    receive->Disconnect();
    FreeMediaTypeContents(&chosen);
    return hr;
  }

  /*
   * Allocator negotiation.
   *
   * The downstream pin is asked for its own allocator first and only refused
   * if it cannot be made big enough; a renderer that has already allocated
   * GPU-friendly buffers should keep them. Two buffers is the minimum that
   * lets us fill one while the host reads the other.
   */
  IMemAllocator* alloc = nullptr;
  if (FAILED(input->GetAllocator(&alloc)) || !alloc) {
    alloc = nullptr;
    if (FAILED(CoCreateInstance(CLSID_MemoryAllocator, nullptr, CLSCTX_INPROC_SERVER,
                                IID_IMemAllocator, reinterpret_cast<void**>(&alloc)))) {
      input->Release();
      receive->Disconnect();
      FreeMediaTypeContents(&chosen);
      return E_FAIL;
    }
  }

  const VIDEOINFOHEADER* vih = AsVideoInfo(&chosen);
  ALLOCATOR_PROPERTIES want{};
  want.cBuffers = 2;
  want.cbBuffer = static_cast<long>(vih->bmiHeader.biSizeImage);
  want.cbAlign = 1;
  want.cbPrefix = 0;
  ALLOCATOR_PROPERTIES got{};
  if (FAILED(alloc->SetProperties(&want, &got)) || got.cbBuffer < want.cbBuffer) {
    alloc->Release();
    input->Release();
    receive->Disconnect();
    FreeMediaTypeContents(&chosen);
    return VFW_E_NO_ALLOCATOR;
  }
  if (FAILED(input->NotifyAllocator(alloc, FALSE))) {
    alloc->Release();
    input->Release();
    receive->Disconnect();
    FreeMediaTypeContents(&chosen);
    return VFW_E_NO_ALLOCATOR;
  }

  FreeMediaTypeContents(&current_);
  current_ = chosen;
  currentVih_ = *vih;
  peer_ = receive;
  peer_->AddRef();
  peerInput_ = input;
  allocator_ = alloc;
  return S_OK;
}

// We are a source: nothing ever connects INTO us.
STDMETHODIMP VifugPin::ReceiveConnection(IPin* connector, const AM_MEDIA_TYPE* mt) {
  return E_UNEXPECTED;
}

STDMETHODIMP VifugPin::Disconnect() {
  if (owner_->State() != State_Stopped) return VFW_E_NOT_STOPPED;
  if (allocator_) {
    allocator_->Release();
    allocator_ = nullptr;
  }
  if (peerInput_) {
    peerInput_->Release();
    peerInput_ = nullptr;
  }
  if (peer_) {
    peer_->Release();
    peer_ = nullptr;
  }
  return S_OK;
}

STDMETHODIMP VifugPin::ConnectedTo(IPin** pin) {
  if (!pin) return E_POINTER;
  *pin = peer_;
  if (!peer_) return VFW_E_NOT_CONNECTED;
  peer_->AddRef();
  return S_OK;
}

STDMETHODIMP VifugPin::ConnectionMediaType(AM_MEDIA_TYPE* mt) {
  if (!mt) return E_POINTER;
  if (!peer_) {
    ZeroMemory(mt, sizeof(*mt));
    return VFW_E_NOT_CONNECTED;
  }
  return CopyMediaType(mt, &current_);
}

STDMETHODIMP VifugPin::QueryPinInfo(PIN_INFO* info) {
  if (!info) return E_POINTER;
  info->pFilter = static_cast<IBaseFilter*>(owner_);
  info->pFilter->AddRef();
  info->dir = PINDIR_OUTPUT;
  wcscpy_s(info->achName, MAX_PIN_NAME, L"Capture");
  return S_OK;
}

STDMETHODIMP VifugPin::QueryDirection(PIN_DIRECTION* dir) {
  if (!dir) return E_POINTER;
  *dir = PINDIR_OUTPUT;
  return S_OK;
}

STDMETHODIMP VifugPin::QueryId(LPWSTR* id) {
  if (!id) return E_POINTER;
  const WCHAR kId[] = L"Capture";
  *id = static_cast<LPWSTR>(CoTaskMemAlloc(sizeof(kId)));
  if (!*id) return E_OUTOFMEMORY;
  memcpy(*id, kId, sizeof(kId));
  return S_OK;
}

STDMETHODIMP VifugPin::QueryAccept(const AM_MEDIA_TYPE* mt) {
  return AcceptableType(mt) ? S_OK : S_FALSE;
}

STDMETHODIMP VifugPin::EnumMediaTypes(IEnumMediaTypes** types) {
  if (!types) return E_POINTER;
  *types = new (std::nothrow) VifugEnumMediaTypes(0);
  return *types ? S_OK : E_OUTOFMEMORY;
}

STDMETHODIMP VifugPin::QueryInternalConnections(IPin** pins, ULONG* count) { return E_NOTIMPL; }
STDMETHODIMP VifugPin::EndOfStream() { return E_UNEXPECTED; }
STDMETHODIMP VifugPin::BeginFlush() { return E_UNEXPECTED; }
STDMETHODIMP VifugPin::EndFlush() { return E_UNEXPECTED; }
STDMETHODIMP VifugPin::NewSegment(REFERENCE_TIME start, REFERENCE_TIME stop, double rate) {
  return S_OK;
}

// ------------------------------------------------------------ IAMStreamConfig

STDMETHODIMP VifugPin::SetFormat(AM_MEDIA_TYPE* mt) {
  if (!mt) return E_POINTER;
  if (!AcceptableType(mt)) return VFW_E_INVALIDMEDIATYPE;
  // Changing the picture under a running graph is how hosts crash. Hosts that
  // want a different size stop, set, and start again - which is what the
  // capture property page does.
  if (owner_->State() != State_Stopped) return VFW_E_NOT_STOPPED;
  if (peer_ && peer_->QueryAccept(mt) != S_OK) return VFW_E_INVALIDMEDIATYPE;

  AM_MEDIA_TYPE copy{};
  HRESULT hr = CopyMediaType(&copy, mt);
  if (FAILED(hr)) return hr;
  FreeMediaTypeContents(&current_);
  current_ = copy;
  currentVih_ = *AsVideoInfo(&current_);
  return S_OK;
}

STDMETHODIMP VifugPin::GetFormat(AM_MEDIA_TYPE** mt) {
  if (!mt) return E_POINTER;
  AM_MEDIA_TYPE* out = static_cast<AM_MEDIA_TYPE*>(CoTaskMemAlloc(sizeof(AM_MEDIA_TYPE)));
  if (!out) return E_OUTOFMEMORY;
  HRESULT hr = CopyMediaType(out, &current_);
  if (FAILED(hr)) {
    CoTaskMemFree(out);
    return hr;
  }
  *mt = out;
  return S_OK;
}

STDMETHODIMP VifugPin::GetNumberOfCapabilities(int* count, int* size) {
  if (!count || !size) return E_POINTER;
  *count = kSizeCount;
  *size = sizeof(VIDEO_STREAM_CONFIG_CAPS);
  return S_OK;
}

STDMETHODIMP VifugPin::GetStreamCaps(int index, AM_MEDIA_TYPE** mt, BYTE* caps) {
  if (!mt || !caps) return E_POINTER;
  if (index < 0 || index >= kSizeCount) return S_FALSE;

  AM_MEDIA_TYPE* out = static_cast<AM_MEDIA_TYPE*>(CoTaskMemAlloc(sizeof(AM_MEDIA_TYPE)));
  if (!out) return E_OUTOFMEMORY;
  HRESULT hr = BuildMediaType(out, kSizes[index].w, kSizes[index].h, kFrameTime30);
  if (FAILED(hr)) {
    CoTaskMemFree(out);
    return hr;
  }

  VIDEO_STREAM_CONFIG_CAPS* vc = reinterpret_cast<VIDEO_STREAM_CONFIG_CAPS*>(caps);
  ZeroMemory(vc, sizeof(*vc));
  const SIZE size = {kSizes[index].w, kSizes[index].h};
  vc->guid = FORMAT_VideoInfo;
  vc->VideoStandard = AnalogVideo_None;
  vc->InputSize = size;
  vc->MinCroppingSize = size;
  vc->MaxCroppingSize = size;
  vc->CropGranularityX = 1;
  vc->CropGranularityY = 1;
  vc->CropAlignX = 1;
  vc->CropAlignY = 1;
  vc->MinOutputSize = size;
  vc->MaxOutputSize = size;
  vc->OutputGranularityX = 1;
  vc->OutputGranularityY = 1;
  vc->MinFrameInterval = kMinFrameTime;
  vc->MaxFrameInterval = kMaxFrameTime;
  const LONG bits = size.cx * size.cy * 32;
  vc->MinBitsPerSecond = bits * 10;
  vc->MaxBitsPerSecond = bits * 60;

  *mt = out;
  return S_OK;
}

// ------------------------------------------------------------ IKsPropertySet

STDMETHODIMP VifugPin::Set(REFGUID set, DWORD id, void* instance, DWORD instanceLen,
                           void* data, DWORD dataLen) {
  return E_NOTIMPL;
}

/*
 * The one property that matters.
 *
 * A host deciding whether this filter is a camera asks the pin which category
 * it is in. Answer anything but PIN_CATEGORY_CAPTURE - or fail the call - and
 * the filter is enumerated but never offered as a video capture device, which
 * is the single most common reason a hand-written virtual camera "does not
 * show up".
 */
STDMETHODIMP VifugPin::Get(REFGUID set, DWORD id, void* instance, DWORD instanceLen,
                           void* data, DWORD dataLen, DWORD* returned) {
  if (set != AMPROPSETID_Pin) return E_PROP_SET_UNSUPPORTED;
  if (id != AMPROPERTY_PIN_CATEGORY) return E_PROP_ID_UNSUPPORTED;
  if (returned) *returned = sizeof(GUID);
  if (!data) return S_OK;              // a size query
  if (dataLen < sizeof(GUID)) return E_UNEXPECTED;
  *static_cast<GUID*>(data) = PIN_CATEGORY_CAPTURE;
  return S_OK;
}

STDMETHODIMP VifugPin::QuerySupported(REFGUID set, DWORD id, DWORD* support) {
  if (set != AMPROPSETID_Pin) return E_PROP_SET_UNSUPPORTED;
  if (id != AMPROPERTY_PIN_CATEGORY) return E_PROP_ID_UNSUPPORTED;
  if (support) *support = KSPROPERTY_SUPPORT_GET;
  return S_OK;
}

STDMETHODIMP VifugPin::Notify(IBaseFilter* self, Quality q) { return S_OK; }
STDMETHODIMP VifugPin::SetSink(IQualityControl* sink) { return S_OK; }

// ------------------------------------------------------- streaming the frames

HRESULT VifugPin::Activate() {
  if (!peer_ || !peerInput_ || !allocator_) return VFW_E_NOT_CONNECTED;
  if (running_) return S_OK;
  HRESULT hr = allocator_->Commit();
  if (FAILED(hr)) return hr;
  stop_ = false;
  frameIndex_ = 0;
  pipe_.Start();
  running_ = true;
  thread_ = std::thread([this] { Pump(); });
  return S_OK;
}

HRESULT VifugPin::Deactivate() {
  if (!running_) return S_OK;
  running_ = false;
  stop_ = true;
  if (thread_.joinable()) thread_.join();
  pipe_.Stop();
  if (allocator_) allocator_->Decommit();
  return S_OK;
}

/*
 * The frame the host sees when Vifug is not publishing.
 *
 * Not black: a black camera is indistinguishable from a broken one, and the
 * first thing an operator does about a black source is start unplugging
 * things. Vifug's own dark surface with its accent bar says "this device is
 * here and working, the app is not sending".
 */
void VifugPin::FillHolding(BYTE* dst, int width, int height, int stride) {
  for (int y = 0; y < height; y++) {
    BYTE* row = dst + static_cast<size_t>(y) * stride;
    for (int x = 0; x < width; x++) {
      row[x * 4 + 0] = kIdleB;
      row[x * 4 + 1] = kIdleG;
      row[x * 4 + 2] = kIdleR;
      row[x * 4 + 3] = 0xFF;
    }
  }
  const int barH = std::max(2, height / 180);
  const int barW = std::max(8, width / 4);
  const int x0 = (width - barW) / 2;
  const int y0 = (height - barH) / 2;
  for (int y = y0; y < y0 + barH && y < height; y++) {
    BYTE* row = dst + static_cast<size_t>(y) * stride;
    for (int x = x0; x < x0 + barW && x < width; x++) {
      row[x * 4 + 0] = kBarB;
      row[x * 4 + 1] = kBarG;
      row[x * 4 + 2] = kBarR;
      row[x * 4 + 3] = 0xFF;
    }
  }
}

void VifugPin::Pump() {
  const int width = currentVih_.bmiHeader.biWidth;
  const int height = static_cast<int>(labs(currentVih_.bmiHeader.biHeight));
  const int stride = width * 4;
  REFERENCE_TIME frameTime = currentVih_.AvgTimePerFrame;
  if (frameTime <= 0) frameTime = kFrameTime30;

  // Ask Vifug to render at exactly what the host negotiated, so the words are
  // never resampled on the way through.
  const uint32_t fpsMilli = static_cast<uint32_t>(10000000.0 * 1000.0 / frameTime);
  pipe_.RequestFormat(static_cast<uint32_t>(width), static_cast<uint32_t>(height), fpsMilli);

  LARGE_INTEGER freq{};
  QueryPerformanceFrequency(&freq);
  LARGE_INTEGER now{};
  QueryPerformanceCounter(&now);
  // Absolute deadlines rather than "sleep for one frame": sleeping relatively
  // accumulates every scheduling overshoot and the camera drifts slow.
  double nextTick = static_cast<double>(now.QuadPart);
  const double tickPerFrame = static_cast<double>(freq.QuadPart) * frameTime / 10000000.0;

  while (!stop_) {
    IMediaSample* sample = nullptr;
    if (FAILED(allocator_->GetBuffer(&sample, nullptr, nullptr, 0)) || !sample) break;

    BYTE* data = nullptr;
    if (FAILED(sample->GetPointer(&data)) || !data) {
      sample->Release();
      break;
    }
    if (sample->GetSize() < stride * height) {
      sample->Release();
      break;
    }

    if (!pipe_.CopyLatest(data, width, height, stride)) FillHolding(data, width, height, stride);

    REFERENCE_TIME start = frameIndex_ * frameTime;
    REFERENCE_TIME end = start + frameTime;
    sample->SetTime(&start, &end);
    sample->SetSyncPoint(TRUE);
    sample->SetDiscontinuity(frameIndex_ == 0);
    sample->SetActualDataLength(stride * height);
    frameIndex_++;

    HRESULT hr = peerInput_->Receive(sample);
    sample->Release();
    if (FAILED(hr)) break;

    nextTick += tickPerFrame;
    QueryPerformanceCounter(&now);
    double waitMs = (nextTick - static_cast<double>(now.QuadPart)) * 1000.0 / freq.QuadPart;
    if (waitMs > 0) {
      Sleep(static_cast<DWORD>(waitMs + 0.5));
    } else if (waitMs < -1000.0) {
      // Fallen more than a second behind - the host stalled. Start again from
      // now rather than sprinting through a backlog nobody wants to see.
      nextTick = static_cast<double>(now.QuadPart);
    }
  }
}

// ------------------------------------------------------------------- filter

VifugFilter::VifugFilter() { pin_ = new (std::nothrow) VifugPin(this); }

VifugFilter::~VifugFilter() {
  delete pin_;
  if (clock_) clock_->Release();
}

STDMETHODIMP VifugFilter::QueryInterface(REFIID riid, void** ppv) {
  if (!ppv) return E_POINTER;
  if (riid == IID_IUnknown || riid == IID_IPersist || riid == IID_IMediaFilter ||
      riid == IID_IBaseFilter) {
    *ppv = static_cast<IBaseFilter*>(this);
  } else if (riid == IID_IAMFilterMiscFlags) {
    *ppv = static_cast<IAMFilterMiscFlags*>(this);
  } else {
    *ppv = nullptr;
    return E_NOINTERFACE;
  }
  AddRef();
  return S_OK;
}

STDMETHODIMP_(ULONG) VifugFilter::AddRef() { return InterlockedIncrement(&refs_); }

STDMETHODIMP_(ULONG) VifugFilter::Release() {
  LONG n = InterlockedDecrement(&refs_);
  if (n == 0) delete this;
  return n;
}

STDMETHODIMP VifugFilter::GetClassID(CLSID* clsid) {
  if (!clsid) return E_POINTER;
  *clsid = CLSID_VifugCamera;
  return S_OK;
}

STDMETHODIMP VifugFilter::Stop() {
  if (state_ == State_Stopped) return S_OK;
  if (pin_) pin_->Deactivate();
  state_ = State_Stopped;
  return S_OK;
}

STDMETHODIMP VifugFilter::Pause() {
  state_ = State_Paused;
  return S_OK;
}

STDMETHODIMP VifugFilter::Run(REFERENCE_TIME start) {
  if (state_ == State_Running) return S_OK;
  state_ = State_Running;
  if (pin_) {
    HRESULT hr = pin_->Activate();
    if (FAILED(hr)) {
      state_ = State_Stopped;
      return hr;
    }
  }
  return S_OK;
}

/*
 * VFW_S_CANT_CUE while paused is not a detail.
 *
 * A live source cannot produce the one buffered frame a paused graph waits
 * for, and a graph that is never told so sits in GetState until it times out.
 * In OBS that is the preview staying black for ten seconds before anything
 * appears.
 */
STDMETHODIMP VifugFilter::GetState(DWORD msTimeout, FILTER_STATE* state) {
  if (!state) return E_POINTER;
  *state = state_;
  return state_ == State_Paused ? VFW_S_CANT_CUE : S_OK;
}

STDMETHODIMP VifugFilter::SetSyncSource(IReferenceClock* clock) {
  if (clock) clock->AddRef();
  if (clock_) clock_->Release();
  clock_ = clock;
  return S_OK;
}

STDMETHODIMP VifugFilter::GetSyncSource(IReferenceClock** clock) {
  if (!clock) return E_POINTER;
  *clock = clock_;
  if (clock_) clock_->AddRef();
  return S_OK;
}

STDMETHODIMP VifugFilter::EnumPins(IEnumPins** pins) {
  if (!pins) return E_POINTER;
  if (!pin_) return E_FAIL;
  *pins = new (std::nothrow) VifugEnumPins(static_cast<IPin*>(pin_), 0);
  return *pins ? S_OK : E_OUTOFMEMORY;
}

STDMETHODIMP VifugFilter::FindPin(LPCWSTR id, IPin** pin) {
  if (!pin) return E_POINTER;
  *pin = nullptr;
  if (!id || !pin_ || _wcsicmp(id, L"Capture") != 0) return VFW_E_NOT_FOUND;
  *pin = static_cast<IPin*>(pin_);
  (*pin)->AddRef();
  return S_OK;
}

STDMETHODIMP VifugFilter::QueryFilterInfo(FILTER_INFO* info) {
  if (!info) return E_POINTER;
  wcscpy_s(info->achName, MAX_FILTER_NAME, name_);
  info->pGraph = graph_;
  if (graph_) graph_->AddRef();
  return S_OK;
}

// The graph pointer is deliberately NOT ref-counted: the graph owns the
// filter, so holding a reference back would make a cycle neither can leave.
STDMETHODIMP VifugFilter::JoinFilterGraph(IFilterGraph* graph, LPCWSTR name) {
  graph_ = graph;
  if (name) wcscpy_s(name_, MAX_FILTER_NAME, name);
  return S_OK;
}

STDMETHODIMP VifugFilter::QueryVendorInfo(LPWSTR* vendor) {
  if (!vendor) return E_POINTER;
  const WCHAR kVendor[] = L"Vifug";
  *vendor = static_cast<LPWSTR>(CoTaskMemAlloc(sizeof(kVendor)));
  if (!*vendor) return E_OUTOFMEMORY;
  memcpy(*vendor, kVendor, sizeof(kVendor));
  return S_OK;
}

STDMETHODIMP_(ULONG) VifugFilter::GetMiscFlags() { return AM_FILTER_MISC_FLAGS_IS_SOURCE; }

HRESULT CreateVifugFilter(REFIID riid, void** ppv) {
  VifugFilter* filter = new (std::nothrow) VifugFilter();
  if (!filter) return E_OUTOFMEMORY;
  HRESULT hr = filter->QueryInterface(riid, ppv);
  filter->Release();
  return hr;
}
