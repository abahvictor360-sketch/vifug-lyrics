// COM plumbing: the class factory, the exports regsvr32 calls, and the
// registry writes that put Vifug in the system's camera list.
#include "filter.h"

#include <new>
#include <string>

static HMODULE g_module = nullptr;
static LONG g_locks = 0;

namespace {

class ClassFactory : public IClassFactory {
 public:
  STDMETHODIMP QueryInterface(REFIID riid, void** ppv) override {
    if (!ppv) return E_POINTER;
    if (riid == IID_IUnknown || riid == IID_IClassFactory) {
      *ppv = static_cast<IClassFactory*>(this);
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
  STDMETHODIMP CreateInstance(IUnknown* outer, REFIID riid, void** ppv) override {
    if (!ppv) return E_POINTER;
    *ppv = nullptr;
    if (outer) return CLASS_E_NOAGGREGATION;
    return CreateVifugFilter(riid, ppv);
  }
  STDMETHODIMP LockServer(BOOL lock) override {
    if (lock) InterlockedIncrement(&g_locks);
    else InterlockedDecrement(&g_locks);
    return S_OK;
  }

 private:
  virtual ~ClassFactory() = default;
  LONG refs_ = 1;
};

std::wstring GuidToString(REFGUID guid) {
  WCHAR buf[64] = {0};
  StringFromGUID2(guid, buf, 64);
  return std::wstring(buf);
}

LONG SetValue(HKEY root, const std::wstring& path, const WCHAR* name, const std::wstring& value) {
  HKEY key = nullptr;
  LONG err = RegCreateKeyExW(root, path.c_str(), 0, nullptr, REG_OPTION_NON_VOLATILE,
                             KEY_WRITE, nullptr, &key, nullptr);
  if (err != ERROR_SUCCESS) return err;
  err = RegSetValueExW(key, name, 0, REG_SZ,
                       reinterpret_cast<const BYTE*>(value.c_str()),
                       static_cast<DWORD>((value.size() + 1) * sizeof(WCHAR)));
  RegCloseKey(key);
  return err;
}

}  // namespace

BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID) {
  if (reason == DLL_PROCESS_ATTACH) {
    g_module = module;
    DisableThreadLibraryCalls(module);
  }
  return TRUE;
}

STDAPI DllGetClassObject(REFCLSID clsid, REFIID riid, void** ppv) {
  if (!ppv) return E_POINTER;
  *ppv = nullptr;
  if (clsid != CLSID_VifugCamera) return CLASS_E_CLASSNOTAVAILABLE;
  ClassFactory* factory = new (std::nothrow) ClassFactory();
  if (!factory) return E_OUTOFMEMORY;
  HRESULT hr = factory->QueryInterface(riid, ppv);
  factory->Release();
  return hr;
}

STDAPI DllCanUnloadNow() { return g_locks == 0 ? S_OK : S_FALSE; }

/*
 * Two registrations, and both are needed.
 *
 * The CLSID keys make the DLL loadable by COM. The filter-mapper entry under
 * CLSID_VideoInputDeviceCategory is what makes it a CAMERA: without it the
 * object exists and can be created by anyone who knows the GUID, and appears
 * in nobody's device list.
 */
STDAPI DllRegisterServer() {
  WCHAR path[MAX_PATH] = {0};
  if (!GetModuleFileNameW(g_module, path, MAX_PATH)) return HRESULT_FROM_WIN32(GetLastError());

  const std::wstring clsid = GuidToString(CLSID_VifugCamera);
  const std::wstring base = L"CLSID\\" + clsid;
  if (SetValue(HKEY_CLASSES_ROOT, base, nullptr, VIFUG_CAMERA_NAME) != ERROR_SUCCESS)
    return E_ACCESSDENIED;
  if (SetValue(HKEY_CLASSES_ROOT, base + L"\\InprocServer32", nullptr, path) != ERROR_SUCCESS)
    return E_ACCESSDENIED;
  // "Both" so the filter can be created on whichever apartment the host uses;
  // every entry point here is thread-safe.
  if (SetValue(HKEY_CLASSES_ROOT, base + L"\\InprocServer32", L"ThreadingModel", L"Both") !=
      ERROR_SUCCESS)
    return E_ACCESSDENIED;

  HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  const bool weInitialised = SUCCEEDED(hr);

  IFilterMapper2* mapper = nullptr;
  hr = CoCreateInstance(CLSID_FilterMapper2, nullptr, CLSCTX_INPROC_SERVER, IID_IFilterMapper2,
                        reinterpret_cast<void**>(&mapper));
  if (SUCCEEDED(hr)) {
    REGPINTYPES types = {&MEDIATYPE_Video, &MEDIASUBTYPE_RGB32};
    REGFILTERPINS pin = {};
    pin.strName = const_cast<LPWSTR>(L"Capture");
    pin.bRendered = FALSE;
    pin.bOutput = TRUE;
    pin.bZero = FALSE;
    pin.bMany = FALSE;
    pin.clsConnectsToFilter = &CLSID_NULL;
    pin.strConnectsToPin = nullptr;
    pin.nMediaTypes = 1;
    pin.lpMediaType = &types;

    REGFILTER2 rf = {};
    rf.dwVersion = 1;
    // A virtual camera must never be auto-selected by Intelligent Connect to
    // render somebody's video file: it is offered, never chosen for you.
    rf.dwMerit = MERIT_DO_NOT_USE;
    rf.cPins = 1;
    rf.rgPins = &pin;

    IMoniker* moniker = nullptr;
    hr = mapper->RegisterFilter(CLSID_VifugCamera, VIFUG_CAMERA_NAME, &moniker,
                                &CLSID_VideoInputDeviceCategory, VIFUG_CAMERA_NAME, &rf);
    if (moniker) moniker->Release();
    mapper->Release();
  }

  if (weInitialised) CoUninitialize();
  return hr;
}

STDAPI DllUnregisterServer() {
  HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  const bool weInitialised = SUCCEEDED(hr);

  IFilterMapper2* mapper = nullptr;
  if (SUCCEEDED(CoCreateInstance(CLSID_FilterMapper2, nullptr, CLSCTX_INPROC_SERVER,
                                 IID_IFilterMapper2, reinterpret_cast<void**>(&mapper)))) {
    mapper->UnregisterFilter(&CLSID_VideoInputDeviceCategory, VIFUG_CAMERA_NAME,
                             CLSID_VifugCamera);
    mapper->Release();
  }
  if (weInitialised) CoUninitialize();

  const std::wstring base = L"CLSID\\" + GuidToString(CLSID_VifugCamera);
  RegDeleteTreeW(HKEY_CLASSES_ROOT, base.c_str());
  return S_OK;
}
