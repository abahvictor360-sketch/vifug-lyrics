// Reads frames from Vifug over the named pipe, on a thread of its own.
//
// This object lives inside the host application (OBS, vMix, ProPresenter), so
// it must never block that application: the streaming thread asks it for the
// newest frame and gets one immediately, whether or not Vifug is running.
#pragma once

#include <windows.h>
#include <stdint.h>
#include <vector>
#include <mutex>
#include <thread>

class PipeClient {
 public:
  PipeClient();
  ~PipeClient();

  // Begins connecting in the background and keeps retrying until Stop().
  void Start();
  void Stop();

  // Tell Vifug what the host negotiated, so it renders at exactly this size
  // and nothing has to be resampled. Safe to call while running.
  void RequestFormat(uint32_t width, uint32_t height, uint32_t fpsMilli);

  // True once a frame has arrived recently; drives the holding frame.
  bool HasPicture();

  // Copy the newest frame into a DirectShow RGB32 buffer: BGRA, bottom-up,
  // letterboxed if the sizes disagree. Returns false when nothing has arrived
  // yet, and the caller paints its holding frame instead.
  bool CopyLatest(uint8_t* dst, int dstWidth, int dstHeight, int dstStride);

 private:
  void Run();                       // the connect/read loop
  bool ReadExact(HANDLE pipe, void* buf, DWORD bytes, HANDLE stop, OVERLAPPED* ov);
  bool WriteRequest(HANDLE pipe, OVERLAPPED* ov);

  std::thread thread_;
  HANDLE stopEvent_ = nullptr;

  std::mutex lock_;                 // guards everything below
  std::vector<uint8_t> frame_;      // newest frame, BGRA top-down
  uint32_t frameWidth_ = 0;
  uint32_t frameHeight_ = 0;
  uint32_t frameStride_ = 0;
  ULONGLONG frameAt_ = 0;           // GetTickCount64 when it landed

  uint32_t wantWidth_ = 1280;
  uint32_t wantHeight_ = 720;
  uint32_t wantFpsMilli_ = 30000;
  bool wantDirty_ = true;           // the request has changed and must be resent
};
