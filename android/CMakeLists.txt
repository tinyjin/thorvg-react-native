cmake_minimum_required(VERSION 3.13)
project(ReactNativeThorVG)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)

add_library(thorvg STATIC IMPORTED)
set_target_properties(thorvg PROPERTIES IMPORTED_LOCATION "${THORVG_LIBS}/${ANDROID_ABI}/libthorvg.a")

add_library(
  reactnativethorvg
  SHARED
  ../cpp/ThorVGBindings.cpp
  ../cpp/ThorVGHandle.cpp
  ../cpp/ThorVGPlayer.cpp
  ../cpp/ThorVGSurface.cpp
  src/main/cpp/AndroidSurface.cpp
  src/main/cpp/AndroidTicker.cpp
  src/main/cpp/OnLoad.cpp
)

target_include_directories(
  reactnativethorvg
  PRIVATE
  ../cpp
  src/main/cpp
  "${THORVG_LIBS}/include"
)

target_compile_options(reactnativethorvg PRIVATE -O2 -Wall -fvisibility=hidden)
target_link_options(reactnativethorvg PRIVATE "-Wl,-z,max-page-size=16384" "-Wl,--gc-sections")

if(ANDROID_ABI STREQUAL "arm64-v8a" OR ANDROID_ABI STREQUAL "x86_64")
  target_compile_definitions(reactnativethorvg PRIVATE THORVG_RN_VULKAN=1)
  target_link_libraries(reactnativethorvg dl)
endif()

target_link_libraries(
  reactnativethorvg
  ReactAndroid::jsi
  ReactAndroid::reactnative
  fbjni::fbjni
  thorvg
  android
  EGL
  log
)
