# The shipping build is MSVC (that is what signs and loads cleanly into every
# host); see build-mingw.sh for the cross-compile used as a cheap syntax and
# link check on non-Windows machines.
cmake_minimum_required(VERSION 3.20)
project(vifug-camera LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(vifug-camera SHARED
  src/filter.cpp
  src/dll.cpp
  src/pipe_client.cpp
)

target_sources(vifug-camera PRIVATE src/vifug-camera.def)

target_link_libraries(vifug-camera PRIVATE
  strmiids ole32 oleaut32 uuid advapi32 winmm
)

if(MSVC)
  target_compile_options(vifug-camera PRIVATE /W4 /permissive- /EHsc)
  # No CRT to install alongside the DLL: it is loaded into other people's
  # processes, so it must not depend on a redistributable they may not have.
  set_property(TARGET vifug-camera PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded")
  target_link_options(vifug-camera PRIVATE "/DEF:${CMAKE_CURRENT_SOURCE_DIR}/src/vifug-camera.def")
endif()

set_target_properties(vifug-camera PROPERTIES PREFIX "" OUTPUT_NAME "vifug-camera")
