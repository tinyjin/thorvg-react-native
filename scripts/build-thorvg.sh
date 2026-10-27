#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THORVG="$ROOT/thorvg"
CROSS="$ROOT/native"
BUILD="$ROOT/build/thorvg"
LIBS="$ROOT/libs"

ANDROID_API=24
IOS_MIN=15.1
WGPU_VERSION=v29.0.1.1
ANDROID_ABIS=(arm64-v8a armeabi-v7a x86_64 x86)
IOS_SLICES=(ios-arm64 ios-sim-arm64 ios-sim-x86_64)
TARGET="${1:-all}"

MESON_OPTIONS=(
  --buildtype=release
  -Db_ndebug=true
  -Ddefault_library=static
  -Dstatic=true
  -Dloaders=svg,png,jpg,lottie,ttf,otf,webp
  -Dsavers=
  -Dthreads=true
  -Dbindings=capi
  -Dpartial=true
  -Dfile=false
  -Dlog=false
  -Dtools=
  -Dtests=false
)

if [ ! -f "$THORVG/meson.build" ]; then
  echo "thorvg submodule is missing. Run: git submodule update --init" >&2
  exit 1
fi

VERSION="$(git -C "$THORVG" describe --tags --always)"

build_slice() {
  local name="$1" constants="$2" simd="$3" engines="$4" extra="$5"
  shift 5
  local dir="$BUILD/$name"

  rm -rf "$dir"
  mkdir -p "$dir"
  printf '%s\n' "$constants" > "$dir/constants.ini"

  meson setup "$dir/build" "$THORVG" \
    --cross-file "$dir/constants.ini" \
    --cross-file "$CROSS/$name.txt" \
    "${MESON_OPTIONS[@]}" \
    -Dengines="$engines" \
    -Dextra="$extra" \
    -Dsimd="$simd" "$@" > "$dir/setup.log"
  ninja -C "$dir/build" > "$dir/ninja.log"

  cp "$dir/build/src/libthorvg-1.a" "$dir/libthorvg.a"
}

copy_headers() {
  local dest="$1"
  mkdir -p "$dest"
  cp "$THORVG/src/bindings/capi/thorvg_capi.h" "$dest/"
}

build_android() {
  local ndk="${ANDROID_NDK_HOME:-}"
  if [ -z "$ndk" ]; then
    local sdk="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
    ndk="$sdk/ndk/$(ls "$sdk/ndk" | grep -E '^[0-9]+\.' | sort -V | tail -1)"
  fi
  local host
  host="$(ls "$ndk/toolchains/llvm/prebuilt" | head -1)"
  local toolchain="$ndk/toolchains/llvm/prebuilt/$host/bin"
  echo "Android NDK: $ndk"

  rm -rf "$LIBS/android"
  for abi in "${ANDROID_ABIS[@]}"; do
    local simd=true
    case "$abi" in x86|x86_64) simd=false ;; esac
    echo "  building $abi"
    build_slice "android-$abi" "[constants]
toolchain = '$toolchain'
api = '$ANDROID_API'" "$simd" cpu,gl lottie_exp,opengl_es
    mkdir -p "$LIBS/android/$abi"
    "$toolchain/llvm-strip" --strip-debug "$BUILD/android-$abi/libthorvg.a" -o "$LIBS/android/$abi/libthorvg.a"
  done
  copy_headers "$LIBS/android/include"
  echo "$VERSION" > "$LIBS/android/VERSION"
}

fetch_wgpu() {
  local slice="$1" arch="$2"
  local dir="$BUILD/wgpu/$slice"
  if [ ! -f "$dir/lib/libwgpu_native.a" ]; then
    rm -rf "$dir"
    mkdir -p "$dir"
    curl -sSfL -o "$dir.zip" \
      "https://github.com/gfx-rs/wgpu-native/releases/download/$WGPU_VERSION/wgpu-ios-$arch-release.zip"
    unzip -q "$dir.zip" -d "$dir"
    rm "$dir.zip"
  fi
  cat > "$dir/wgpu_native.pc" <<EOF
Name: wgpu_native
Description: wgpu-native
Version: ${WGPU_VERSION#v}
Cflags: -I$dir/include
Libs: -L$dir/lib -lwgpu_native
EOF
}

build_ios() {
  local toolchain iphoneos simulator
  toolchain="$(dirname "$(xcrun -f clang)")"
  iphoneos="$(xcrun --sdk iphoneos --show-sdk-path)"
  simulator="$(xcrun --sdk iphonesimulator --show-sdk-path)"

  for slice in "${IOS_SLICES[@]}"; do
    local simd=true arch=aarch64
    case "$slice" in *x86_64) simd=false ;; esac
    case "$slice" in
      ios-sim-arm64) arch=aarch64-simulator ;;
      ios-sim-x86_64) arch=x86_64-simulator ;;
    esac
    echo "  building $slice"
    fetch_wgpu "$slice" "$arch"
    build_slice "$slice" "[constants]
toolchain = '$toolchain'
ios_min = '$IOS_MIN'
iphoneos_sdk = '$iphoneos'
simulator_sdk = '$simulator'" "$simd" cpu,wg lottie_exp -Dpkg_config_path="$BUILD/wgpu/$slice"
    strip -S "$BUILD/$slice/libthorvg.a" 2>/dev/null
  done

  local stage="$BUILD/ios-stage"
  rm -rf "$stage"
  mkdir -p "$stage/device" "$stage/simulator"
  cp "$BUILD/ios-arm64/libthorvg.a" "$stage/device/"
  lipo -create "$BUILD/ios-sim-arm64/libthorvg.a" "$BUILD/ios-sim-x86_64/libthorvg.a" -output "$stage/simulator/libthorvg.a"
  copy_headers "$stage/include"

  rm -rf "$LIBS/ios"
  mkdir -p "$LIBS/ios"
  xcodebuild -create-xcframework \
    -library "$stage/device/libthorvg.a" -headers "$stage/include" \
    -library "$stage/simulator/libthorvg.a" -headers "$stage/include" \
    -output "$LIBS/ios/thorvg.xcframework" > /dev/null
  echo "$VERSION" > "$LIBS/ios/VERSION"

  # Stands in for wgpu-native when thorvg-react-native-webgpu is not installed, so the
  # wg engine inside libthorvg links even without dead stripping. Never called: wg stays disabled.
  local stub="$BUILD/wgpu-stub"
  rm -rf "$stub"
  mkdir -p "$stub/simulator"
  nm -u "$BUILD/ios-arm64/libthorvg.a" | grep -E '^_wgpu' | sort -u | sed -E 's/^_(.*)/void* \1(void) { return 0; }/' > "$stub/stub.c"
  xcrun --sdk iphoneos clang -c -Os -arch arm64 -miphoneos-version-min="$IOS_MIN" "$stub/stub.c" -o "$stub/device.o"
  xcrun --sdk iphonesimulator clang -c -Os -arch arm64 -mios-simulator-version-min="$IOS_MIN" "$stub/stub.c" -o "$stub/sim-arm64.o"
  xcrun --sdk iphonesimulator clang -c -Os -arch x86_64 -mios-simulator-version-min="$IOS_MIN" "$stub/stub.c" -o "$stub/sim-x86_64.o"
  libtool -static -o "$stub/libwgpu_stub.a" "$stub/device.o" 2>/dev/null
  libtool -static -o "$stub/simulator/libwgpu_stub.a" "$stub/sim-arm64.o" "$stub/sim-x86_64.o" 2>/dev/null
  xcodebuild -create-xcframework \
    -library "$stub/libwgpu_stub.a" \
    -library "$stub/simulator/libwgpu_stub.a" \
    -output "$LIBS/ios/wgpu-stub.xcframework" > /dev/null

  # wgpu-native is linked only when thorvg-react-native-webgpu is installed.
  local wgpu="$BUILD/wgpu-stage"
  rm -rf "$wgpu"
  mkdir -p "$wgpu/simulator" "$wgpu/include"
  lipo -create "$BUILD/wgpu/ios-sim-arm64/lib/libwgpu_native.a" "$BUILD/wgpu/ios-sim-x86_64/lib/libwgpu_native.a" -output "$wgpu/simulator/libwgpu_native.a"
  cp -R "$BUILD/wgpu/ios-arm64/include/webgpu" "$wgpu/include/"

  rm -rf "$LIBS/webgpu/ios"
  mkdir -p "$LIBS/webgpu/ios"
  xcodebuild -create-xcframework \
    -library "$BUILD/wgpu/ios-arm64/lib/libwgpu_native.a" -headers "$wgpu/include" \
    -library "$wgpu/simulator/libwgpu_native.a" -headers "$wgpu/include" \
    -output "$LIBS/webgpu/ios/wgpu.xcframework" > /dev/null
  echo "$VERSION" > "$LIBS/webgpu/VERSION"
}

echo "ThorVG $VERSION"
case "$TARGET" in
  android) build_android ;;
  ios) build_ios ;;
  all) build_android; build_ios ;;
  *) echo "Usage: $0 [android|ios|all]" >&2; exit 1 ;;
esac
cp "$THORVG/LICENSE" "$LIBS/LICENSE"
echo "Done: $LIBS"
