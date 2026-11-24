#include "pipe_client.h"
#include "wire.h"

#include <algorithm>

namespace {

// How long a frame stays "current". Vifug repeats the picture when the slide
// is still, so a gap longer than this means the app has gone away rather than
// that nothing is changing.
const ULONGLONG kStaleMs = 2000;

// Pause between connection attempts. Long enough not to spin, short enough
// that starting Vifug after OBS feels immediate.
const DWORD kRetryMs = 500;

}  // namespace

PipeClient::PipeClient() {
  stopEvent_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
}

PipeClient::~PipeClient() {
  Stop();
  if (stopEvent_) CloseHandle(stopEvent_);
}

void PipeClient::Start() {
  if (thread_.joinable()) return;
  ResetEvent(stopEvent_);
  thread_ = std::thread([this] { Run(); });
}

void PipeClient::Stop() {
  if (!thread_.joinable()) return;
  SetEvent(stopEvent_);
  thread_.join();
}

void PipeClient::RequestFormat(uint32_t width, uint32_t height, uint32_t fpsMilli) {
  std::lock_guard<std::mutex> guard(lock_);
  if (wantWidth_ == width && wantHeight_ == height && wantFpsMilli_ == fpsMilli) return;
  wantWidth_ = width;
  wantHeight_ = height;
  wantFpsMilli_ = fpsMilli;
  wantDirty_ = true;
}

bool PipeClient::HasPicture() {
  std::lock_guard<std::mutex> guard(lock_);
  return frameAt_ != 0 && GetTickCount64() - frameAt_ < kStaleMs;
}

/*
 * Overlapped reads rather than blocking ones.
 *
 * The streaming thread can be told to stop at any moment, and a plain
 * ReadFile on a pipe with nothing coming would sit there until the host gave
 * up and killed the process - which, in OBS, looks like OBS hanging on exit.
 * Waiting on the read and the stop event together is what makes Stop()
 * immediate.
 */
bool PipeClient::ReadExact(HANDLE pipe, void* buf, DWORD bytes, HANDLE stop, OVERLAPPED* ov) {
  uint8_t* at = static_cast<uint8_t*>(buf);
  DWORD left = bytes;
  while (left > 0) {
    ResetEvent(ov->hEvent);
    DWORD got = 0;
    if (!ReadFile(pipe, at, left, &got, ov)) {
      if (GetLastError() != ERROR_IO_PENDING) return false;
      HANDLE waits[2] = {ov->hEvent, stop};
      DWORD which = WaitForMultipleObjects(2, waits, FALSE, INFINITE);
      if (which != WAIT_OBJECT_0) {
        CancelIoEx(pipe, ov);
        return false;
      }
      if (!GetOverlappedResult(pipe, ov, &got, FALSE)) return false;
    }
    if (got == 0) return false;  // the far end closed
    at += got;
    left -= got;
  }
  return true;
}

bool PipeClient::WriteRequest(HANDLE pipe, OVERLAPPED* ov) {
  VifugRequest req{};
  {
    std::lock_guard<std::mutex> guard(lock_);
    req.magic = VIFUG_REQ_MAGIC;
    req.version = VIFUG_WIRE_VERSION;
    req.kind = VIFUG_REQ_FORMAT;
    req.width = wantWidth_;
    req.height = wantHeight_;
    req.fpsMilli = wantFpsMilli_;
    wantDirty_ = false;
  }
  ResetEvent(ov->hEvent);
  DWORD wrote = 0;
  if (WriteFile(pipe, &req, sizeof(req), &wrote, ov)) return wrote == sizeof(req);
  if (GetLastError() != ERROR_IO_PENDING) return false;
  if (!GetOverlappedResult(pipe, ov, &wrote, TRUE)) return false;
  return wrote == sizeof(req);
}

void PipeClient::Run() {
  OVERLAPPED ov{};
  ov.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  std::vector<uint8_t> scratch;

  while (WaitForSingleObject(stopEvent_, 0) != WAIT_OBJECT_0) {
    HANDLE pipe = CreateFileW(VIFUG_PIPE_NAME, GENERIC_READ | GENERIC_WRITE, 0, nullptr,
                              OPEN_EXISTING, FILE_FLAG_OVERLAPPED, nullptr);
    if (pipe == INVALID_HANDLE_VALUE) {
      // Vifug is not running, or not publishing. Wait and try again; this is
      // the ordinary state of things, not an error worth reporting.
      if (WaitForSingleObject(stopEvent_, kRetryMs) == WAIT_OBJECT_0) break;
      continue;
    }

    if (!WriteRequest(pipe, &ov)) {
      CloseHandle(pipe);
      if (WaitForSingleObject(stopEvent_, kRetryMs) == WAIT_OBJECT_0) break;
      continue;
    }

    for (;;) {
      bool resend;
      {
        std::lock_guard<std::mutex> guard(lock_);
        resend = wantDirty_;
      }
      if (resend && !WriteRequest(pipe, &ov)) break;

      VifugFrameHeader head{};
      if (!ReadExact(pipe, &head, sizeof(head), stopEvent_, &ov)) break;
      if (head.magic != VIFUG_FRAME_MAGIC || head.version != VIFUG_WIRE_VERSION) break;
      if (head.format != VIFUG_FMT_BGRA32) break;
      // A corrupt or hostile length must not become a gigabyte allocation.
      if (head.width == 0 || head.height == 0 || head.width > 7680 || head.height > 4320) break;
      if (head.stride < head.width * 4u) break;
      if (head.payload != head.stride * head.height) break;

      scratch.resize(head.payload);
      if (!ReadExact(pipe, scratch.data(), head.payload, stopEvent_, &ov)) break;

      {
        std::lock_guard<std::mutex> guard(lock_);
        frame_.swap(scratch);
        frameWidth_ = head.width;
        frameHeight_ = head.height;
        frameStride_ = head.stride;
        frameAt_ = GetTickCount64();
      }
    }

    CloseHandle(pipe);
    if (WaitForSingleObject(stopEvent_, kRetryMs) == WAIT_OBJECT_0) break;
  }

  CloseHandle(ov.hEvent);
}

/*
 * Into a DirectShow RGB32 buffer, which is bottom-up: destination row 0 is the
 * BOTTOM of the picture. Getting that backwards is the classic way to ship a
 * virtual camera that works and is upside down.
 *
 * When the sizes agree - the usual case, because the host's choice is passed
 * back to Vifug and rendered at that exact size - this is a row-reversed
 * memcpy and nothing is resampled. The letterboxing path exists for the first
 * frames after a renegotiation, and keeps the aspect ratio rather than
 * stretching the words.
 */
bool PipeClient::CopyLatest(uint8_t* dst, int dstWidth, int dstHeight, int dstStride) {
  std::lock_guard<std::mutex> guard(lock_);
  if (frame_.empty() || frameWidth_ == 0 || frameHeight_ == 0) return false;
  if (GetTickCount64() - frameAt_ >= kStaleMs) return false;

  const int srcW = static_cast<int>(frameWidth_);
  const int srcH = static_cast<int>(frameHeight_);
  const int srcStride = static_cast<int>(frameStride_);
  const uint8_t* src = frame_.data();

  if (srcW == dstWidth && srcH == dstHeight) {
    for (int y = 0; y < dstHeight; y++) {
      memcpy(dst + static_cast<size_t>(y) * dstStride,
             src + static_cast<size_t>(dstHeight - 1 - y) * srcStride,
             static_cast<size_t>(dstWidth) * 4);
    }
    return true;
  }

  memset(dst, 0, static_cast<size_t>(dstStride) * dstHeight);

  const double scale = std::min(static_cast<double>(dstWidth) / srcW,
                                static_cast<double>(dstHeight) / srcH);
  const int boxW = std::max(1, static_cast<int>(srcW * scale));
  const int boxH = std::max(1, static_cast<int>(srcH * scale));
  const int offX = (dstWidth - boxW) / 2;
  const int offY = (dstHeight - boxH) / 2;

  for (int by = 0; by < boxH; by++) {
    const double fy = (by + 0.5) * srcH / boxH - 0.5;
    const int y0 = std::clamp(static_cast<int>(fy), 0, srcH - 1);
    const int y1 = std::min(y0 + 1, srcH - 1);
    const double wy = std::clamp(fy - y0, 0.0, 1.0);
    const uint8_t* row0 = src + static_cast<size_t>(y0) * srcStride;
    const uint8_t* row1 = src + static_cast<size_t>(y1) * srcStride;
    // Bottom-up destination: the top row of the box is the last one written.
    uint8_t* out = dst + static_cast<size_t>(dstHeight - 1 - (offY + by)) * dstStride
                       + static_cast<size_t>(offX) * 4;

    for (int bx = 0; bx < boxW; bx++) {
      const double fx = (bx + 0.5) * srcW / boxW - 0.5;
      const int x0 = std::clamp(static_cast<int>(fx), 0, srcW - 1);
      const int x1 = std::min(x0 + 1, srcW - 1);
      const double wx = std::clamp(fx - x0, 0.0, 1.0);
      for (int c = 0; c < 4; c++) {
        const double top = row0[x0 * 4 + c] * (1 - wx) + row0[x1 * 4 + c] * wx;
        const double bot = row1[x0 * 4 + c] * (1 - wx) + row1[x1 * 4 + c] * wx;
        out[bx * 4 + c] = static_cast<uint8_t>(top * (1 - wy) + bot * wy + 0.5);
      }
    }
  }
  return true;
}
