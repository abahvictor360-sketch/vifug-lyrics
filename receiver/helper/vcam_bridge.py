"""
vcam-bridge: raw RGB frames on stdin -> a virtual camera.

Used on Windows, where ffmpeg cannot write to a camera device itself. The
receiver starts this with the camera's size and rate and pipes frames into it.
It uses pyvirtualcam, which drives whichever free virtual-camera driver is
installed (OBS Studio's virtual camera, or Unity Capture).

Built into vcam-bridge.exe with PyInstaller (see .github/workflows/receiver-build.yml).
"""
import argparse
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--width", type=int, required=True)
    ap.add_argument("--height", type=int, required=True)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--device", default=None)
    ap.add_argument("--backend", default=None, help="obs or unitycapture; default tries both")
    a = ap.parse_args()

    try:
        import numpy as np
        import pyvirtualcam
    except Exception as e:  # a broken build, not a user problem
        print(f"The camera helper is incomplete: {e}", file=sys.stderr)
        return 3

    try:
        cam = pyvirtualcam.Camera(
            a.width, a.height, a.fps, fmt=pyvirtualcam.PixelFormat.RGB, device=a.device, backend=a.backend
        )
    except Exception as e:
        print(
            "No virtual camera driver is available. Install OBS Studio (free, from obsproject.com), "
            "open it once and start its virtual camera, or install Unity Capture. Then start the camera again.\n"
            f"({e})",
            file=sys.stderr,
        )
        return 2

    size = a.width * a.height * 3
    stdin = sys.stdin.buffer
    with cam:
        print(f"Camera ready: {cam.device}", file=sys.stderr, flush=True)
        while True:
            buf = b""
            while len(buf) < size:
                chunk = stdin.read(size - len(buf))
                if not chunk:
                    return 0
                buf += chunk
            cam.send(np.frombuffer(buf, dtype=np.uint8).reshape(a.height, a.width, 3))
    return 0


if __name__ == "__main__":
    sys.exit(main())
