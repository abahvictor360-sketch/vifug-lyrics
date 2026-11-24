#!/bin/bash
# Cross-compile the camera driver from Linux. This does NOT produce the DLL
# that ships - that is the MSVC build - but it compiles and links every line,
# which catches the great majority of mistakes without a Windows machine.
set -euo pipefail
cd "$(dirname "$0")"
out="${1:-build/vifug-camera.dll}"
mkdir -p "$(dirname "$out")"
x86_64-w64-mingw32-g++ -std=c++17 -O2 -Wall -Wextra -Wno-unused-parameter \
  -shared -o "$out" \
  src/filter.cpp src/dll.cpp src/pipe_client.cpp src/vifug-camera.def \
  -static-libgcc -static-libstdc++ \
  -lstrmiids -lole32 -loleaut32 -luuid -ladvapi32 -lwinmm
echo "built $out"
x86_64-w64-mingw32-objdump -p "$out" | grep -E "^\s+\[\s*[0-9]+\] Dll" || true
