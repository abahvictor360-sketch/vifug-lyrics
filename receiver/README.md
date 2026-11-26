# Vifug Receiver

A small app for the **other** computer. Vifug runs on computer A; the Receiver runs on computer B and shows A's live screen there:

- **Full screen** on any screen of B, with sound, optionally **transparent**.
- A **camera** (Windows and Linux) that OBS, vMix, Zoom, Teams and others can pick like a webcam. Vifug itself never runs on B.

It does not copy Vifug. It opens the live pages Vifug already serves on its network address (`/#/projector`, or `/#/stream` for the transparent one), so what B shows is exactly what A is sending.

## How it finds Vifug

The desktop app broadcasts a tiny UDP packet (port 47890, every 2 seconds) with its computer name and port. The Receiver lists whatever it hears. It can also be given an address by hand (`192.168.1.20:4200`). Both computers must be on the same network, and Vifug must be allowed through the firewall on A (Vifug, Settings, Streaming & output).

## The camera

A camera cannot carry transparency, so the Receiver lays the picture over a solid colour you choose (black, or a key colour to remove in the other program), scales it to 1280x720 or 1920x1080 and sends it at 24, 30 or 60 frames a second.

| System | Needs (once) | Appears as |
|---|---|---|
| Linux | `v4l2loopback`: `sudo modprobe v4l2loopback devices=1 video_nr=10 card_label="Vifug" exclusive_caps=1` | "Vifug" |
| Windows | A free virtual-camera driver: OBS Studio's virtual camera (install OBS, open it once, start its virtual camera) or Unity Capture | "OBS Virtual Camera" (or "Unity Video Capture") |
| Mac | Not available yet. The full-screen view works. | - |

Linux: ffmpeg writes straight to the loopback device. Windows: ffmpeg converts the frames and pipes them to `vcam-bridge.exe` (`helper/vcam_bridge.py`, built with PyInstaller), which hands them to the installed driver through pyvirtualcam.

## Run and build

```
cd receiver
npm install
npm start          # run
npm test           # discovery and camera pipeline tests (need no Electron)
npm run dist       # installer for the system you are on
```

On Windows build the helper first: `pip install pyvirtualcam numpy pyinstaller` then `pyinstaller --onefile --name vcam-bridge --distpath helper/dist helper/vcam_bridge.py`. The `Build Vifug Receiver` workflow does all of this for the three systems.

## What has and has not been tested

Tested without Electron: the beacon and discovery parsing, the camera pipeline against real ffmpeg (a transparent frame over a green background, an opaque frame unchanged, scaling, the pipe to a helper process), the loopback device finder, and the control window's behaviour. **Not yet run:** Electron itself (offscreen painting and the two windows), the Linux loopback device, and the Windows driver path - these need a real machine of each kind.
