# Vifug virtual camera (Windows)

A DirectShow video capture source filter that puts **Vifug** in the system's
camera list, so OBS, vMix and ProPresenter can add it with *Video Capture
Device → Vifug* — no plugin, no URL to paste, nothing for a volunteer to
configure.

It is written directly against the COM interfaces rather than on a sample
framework or a fork of an existing virtual camera, so nothing here carries a
licence Vifug cannot ship.

## How the picture gets here

Vifug runs a named-pipe **server** at `\\.\pipe\vifug-camera-v1`; this driver,
loaded inside the host application, is the **client**. That direction is
deliberate — OBS is often started before Vifug and left running after it, and
a client that simply retries every half second is far easier to reason about
than a device that has to be told to go away.

When a host negotiates a size, the driver sends it back up the pipe and Vifug
renders at exactly that size, so lyrics are never resampled on the way
through. If the sizes disagree anyway, the driver letterboxes rather than
stretches.

With Vifug not running, the camera still enumerates and shows a dark holding
frame with Vifug's accent bar across it. That is on purpose: a black source is
indistinguishable from a broken one, and the first thing an operator does
about a black source is start unplugging things.

The wire format is in `src/wire.h`, and the Vifug end of it is
`packages/desktop/electron/virtual-camera.ts`. Change one and you must change
the other.

## Building

The shipping build is MSVC, because that is what signs and loads cleanly into
every host:

```
cmake -S . -B build -A x64
cmake --build build --config Release
```

The result is `build/Release/vifug-camera.dll`. `electron-builder` expects it
at `packages/desktop/build/camera/vifug-camera.dll`; the installer registers
it from there.

### Checking it compiles without Windows

`./build-mingw.sh` cross-compiles the whole driver with mingw-w64 on Linux.
That is **not** the DLL that ships, but it compiles and links every line, which
catches the great majority of mistakes on a machine with no Visual Studio:

```
sudo apt-get install g++-mingw-w64-x86-64
./build-mingw.sh
```

## Installing by hand

Registering a DirectShow filter writes under `HKEY_CLASSES_ROOT`, so it needs
an elevated prompt. The Vifug installer does this for you; to do it yourself:

```
regsvr32 vifug-camera.dll          :: register
regsvr32 /u vifug-camera.dll       :: remove
```

A per-user (unelevated) install of Vifug cannot register it. The app notices
and says so — Settings → Streaming & output → Virtual camera reports *the
camera driver is not registered* rather than pretending to work.

## What it offers

RGB32 at 1920×1080, 1600×900, 1280×720, 1024×576, 854×480 and 640×360, up to
60fps. RGB32 because that is what Vifug already has in hand, so nothing is
converted anywhere in the path.

There is no audio: a video capture device carries picture only. Sound reaches
OBS the way it always has.

There is also no alpha. A camera device is opaque by definition, so a lower
third that is transparent over the browser source or over NDI arrives here on
a black background. For keying, keep using the `/#/stream` browser source.

## If it does not appear in the list

- **Check it is registered.** `reg query HKCR\CLSID\{7E3F1A52-9C4D-4B86-9F1C-2A5D8E0B7C31}`
  should print an `InprocServer32` pointing at the DLL.
- **Check the architecture.** A 64-bit host cannot load a 32-bit filter or the
  other way round. OBS and vMix are 64-bit; build x64.
- **Restart the host.** Most of them enumerate cameras once at startup.
- **Antivirus.** Registering a camera is exactly the shape of a thing security
  software blocks. If the key is missing right after an install that reported
  success, that is usually why.

## The GUID

`{7E3F1A52-9C4D-4B86-9F1C-2A5D8E0B7C31}` is the camera's identity in every
host's saved scene. Never change it: a new one silently orphans every source
anybody has already configured.
