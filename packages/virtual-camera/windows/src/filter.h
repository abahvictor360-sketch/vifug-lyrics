// A DirectShow video capture source filter, written against the COM
// interfaces directly rather than on Microsoft's old sample base classes, so
// nothing here carries a licence Vifug cannot ship.
//
// What the host sees: one filter with one output pin, registered under
// CLSID_VideoInputDeviceCategory, offering RGB32 at a handful of sizes. What
// the pin actually sends is whatever Vifug put down the pipe - see
// pipe_client.h.
#pragma once

#include <windows.h>
#include <strmif.h>
#include <control.h>
#include <uuids.h>
#include <amvideo.h>
#include <vfwmsgs.h>
#include <ks.h>
#include <ksmedia.h>

#include <atomic>
#include <thread>
#include <vector>

#include "pipe_client.h"

// {7E3F1A52-9C4D-4B86-9F1C-2A5D8E0B7C31} - Vifug's own, generated once and
// never changed: this GUID is the camera's identity in every host's saved
// scene, so a new one would silently orphan every configured source.
EXTERN_C const GUID CLSID_VifugCamera;

#define VIFUG_CAMERA_NAME L"Vifug"

class VifugFilter;

// The one output pin. Owns the connection, the format and the pumping thread.
class VifugPin : public IPin, public IAMStreamConfig, public IKsPropertySet, public IQualityControl {
 public:
  explicit VifugPin(VifugFilter* owner);
  virtual ~VifugPin();

  // IUnknown
  STDMETHODIMP QueryInterface(REFIID riid, void** ppv) override;
  STDMETHODIMP_(ULONG) AddRef() override;
  STDMETHODIMP_(ULONG) Release() override;

  // IPin
  STDMETHODIMP Connect(IPin* receive, const AM_MEDIA_TYPE* mt) override;
  STDMETHODIMP ReceiveConnection(IPin* connector, const AM_MEDIA_TYPE* mt) override;
  STDMETHODIMP Disconnect() override;
  STDMETHODIMP ConnectedTo(IPin** pin) override;
  STDMETHODIMP ConnectionMediaType(AM_MEDIA_TYPE* mt) override;
  STDMETHODIMP QueryPinInfo(PIN_INFO* info) override;
  STDMETHODIMP QueryDirection(PIN_DIRECTION* dir) override;
  STDMETHODIMP QueryId(LPWSTR* id) override;
  STDMETHODIMP QueryAccept(const AM_MEDIA_TYPE* mt) override;
  STDMETHODIMP EnumMediaTypes(IEnumMediaTypes** types) override;
  STDMETHODIMP QueryInternalConnections(IPin** pins, ULONG* count) override;
  STDMETHODIMP EndOfStream() override;
  STDMETHODIMP BeginFlush() override;
  STDMETHODIMP EndFlush() override;
  STDMETHODIMP NewSegment(REFERENCE_TIME start, REFERENCE_TIME stop, double rate) override;

  // IAMStreamConfig
  STDMETHODIMP SetFormat(AM_MEDIA_TYPE* mt) override;
  STDMETHODIMP GetFormat(AM_MEDIA_TYPE** mt) override;
  STDMETHODIMP GetNumberOfCapabilities(int* count, int* size) override;
  STDMETHODIMP GetStreamCaps(int index, AM_MEDIA_TYPE** mt, BYTE* caps) override;

  // IKsPropertySet - how a host learns this is a CAPTURE pin.
  STDMETHODIMP Set(REFGUID set, DWORD id, void* instance, DWORD instanceLen,
                   void* data, DWORD dataLen) override;
  STDMETHODIMP Get(REFGUID set, DWORD id, void* instance, DWORD instanceLen,
                   void* data, DWORD dataLen, DWORD* returned) override;
  STDMETHODIMP QuerySupported(REFGUID set, DWORD id, DWORD* support) override;

  // IQualityControl - we are a live source; dropped frames are not our problem
  // to solve by slowing down, so this accepts and ignores.
  STDMETHODIMP Notify(IBaseFilter* self, Quality q) override;
  STDMETHODIMP SetSink(IQualityControl* sink) override;

  HRESULT Activate();    // graph is running: commit the allocator, start pumping
  HRESULT Deactivate();  // graph stopped

 private:
  void Pump();
  void FillHolding(BYTE* dst, int width, int height, int stride);

  VifugFilter* owner_;  // weak: the filter outlives its pin
  IPin* peer_ = nullptr;
  IMemInputPin* peerInput_ = nullptr;
  IMemAllocator* allocator_ = nullptr;

  AM_MEDIA_TYPE current_{};
  VIDEOINFOHEADER currentVih_{};

  std::thread thread_;
  std::atomic<bool> stop_{false};
  std::atomic<bool> running_{false};
  REFERENCE_TIME frameIndex_ = 0;

  PipeClient pipe_;
};

class VifugFilter : public IBaseFilter, public IAMFilterMiscFlags {
 public:
  VifugFilter();
  virtual ~VifugFilter();

  STDMETHODIMP QueryInterface(REFIID riid, void** ppv) override;
  STDMETHODIMP_(ULONG) AddRef() override;
  STDMETHODIMP_(ULONG) Release() override;

  // IPersist
  STDMETHODIMP GetClassID(CLSID* clsid) override;

  // IMediaFilter
  STDMETHODIMP Stop() override;
  STDMETHODIMP Pause() override;
  STDMETHODIMP Run(REFERENCE_TIME start) override;
  STDMETHODIMP GetState(DWORD msTimeout, FILTER_STATE* state) override;
  STDMETHODIMP SetSyncSource(IReferenceClock* clock) override;
  STDMETHODIMP GetSyncSource(IReferenceClock** clock) override;

  // IBaseFilter
  STDMETHODIMP EnumPins(IEnumPins** pins) override;
  STDMETHODIMP FindPin(LPCWSTR id, IPin** pin) override;
  STDMETHODIMP QueryFilterInfo(FILTER_INFO* info) override;
  STDMETHODIMP JoinFilterGraph(IFilterGraph* graph, LPCWSTR name) override;
  STDMETHODIMP QueryVendorInfo(LPWSTR* vendor) override;

  // IAMFilterMiscFlags
  STDMETHODIMP_(ULONG) GetMiscFlags() override;

  VifugPin* Pin() { return pin_; }
  IReferenceClock* Clock() { return clock_; }
  FILTER_STATE State() { return state_; }

 private:
  LONG refs_ = 1;
  VifugPin* pin_ = nullptr;
  IFilterGraph* graph_ = nullptr;   // weak, per DirectShow's rules
  IReferenceClock* clock_ = nullptr;
  FILTER_STATE state_ = State_Stopped;
  WCHAR name_[MAX_FILTER_NAME] = VIFUG_CAMERA_NAME;
};

// Exposed for dll.cpp's class factory.
HRESULT CreateVifugFilter(REFIID riid, void** ppv);
