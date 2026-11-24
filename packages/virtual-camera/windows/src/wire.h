// The contract between Vifug and the camera driver.
//
// Vifug (the Electron app) runs a named-pipe SERVER; this driver, which lives
// inside OBS / vMix / ProPresenter, connects to it as a client. That direction
// is deliberate: the app owns the picture and is the thing a person starts, so
// the camera can appear in the list whether or not Vifug is running, and show
// a holding frame until it is.
//
// Both sides are little-endian x86/x64, so the structs go down the pipe as
// they sit in memory. Every field is fixed-width and the sizes are asserted.
#pragma once

#include <stdint.h>

#define VIFUG_PIPE_NAME L"\\\\.\\pipe\\vifug-camera-v1"

// FourCCs, written out by hand so the byte order is not a guess.
static const uint32_t VIFUG_FRAME_MAGIC = 0x4D524656u;  // 'V' 'F' 'R' 'M'
static const uint32_t VIFUG_REQ_MAGIC   = 0x51455256u;  // 'V' 'R' 'E' 'Q'
static const uint16_t VIFUG_WIRE_VERSION = 1;

// Pixel layouts the app may send. Only BGRA32 exists today; the field is here
// so a later NV12 (a third of the bytes) does not need a new protocol.
enum VifugPixelFormat : uint16_t {
  VIFUG_FMT_BGRA32 = 0,  // B,G,R,A in memory, rows top-down
};

#pragma pack(push, 1)

// Server -> client, immediately followed by `payload` bytes of pixels.
struct VifugFrameHeader {
  uint32_t magic;    // VIFUG_FRAME_MAGIC
  uint16_t version;  // VIFUG_WIRE_VERSION
  uint16_t format;   // VifugPixelFormat
  uint32_t width;
  uint32_t height;
  uint32_t stride;   // bytes per row, >= width * 4
  uint32_t payload;  // stride * height
  uint64_t timeMs;   // the writer's clock, for diagnosis only
};

// Client -> server. Sent once on connect and again whenever the host
// renegotiates, so Vifug can render at exactly the size being asked for and
// the driver never has to resample text.
struct VifugRequest {
  uint32_t magic;    // VIFUG_REQ_MAGIC
  uint16_t version;  // VIFUG_WIRE_VERSION
  uint16_t kind;     // VIFUG_REQ_FORMAT
  uint32_t width;
  uint32_t height;
  uint32_t fpsMilli; // frames per second x 1000; 30000 is 30fps
};

#pragma pack(pop)

enum VifugRequestKind : uint16_t {
  VIFUG_REQ_FORMAT = 1,
};

static_assert(sizeof(VifugFrameHeader) == 32, "frame header must stay 32 bytes");
static_assert(sizeof(VifugRequest) == 20, "request must stay 20 bytes");
