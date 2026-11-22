#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THORVG="$ROOT/thorvg"
GPU_ENGINES="$ROOT/native/thorvg-gpu.txt"
RERERE="$ROOT/native/thorvg-rerere"
CROSS="$ROOT/native"
BUILD="$ROOT/build/thorvg"
LIBS="$ROOT/libs"

ANDROID_API=24
IOS_MIN=15.1
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
  -Dtests=false
)

if [ ! -f "$THORVG/meson.build" ]; then
  echo "thorvg submodule is missing. Run: git submodule update --init" >&2
  exit 1
fi

VERSION="$(git -C "$THORVG" describe --tags --always)"
SOURCE="$BUILD/source"

prepare_source() {
  src() { git -C "$SOURCE" -c user.name=thorvg-react-native -c user.email=thorvg-react-native@localhost -c core.editor=true "$@"; }

  [ -d "$SOURCE/.git" ] || { rm -rf "$SOURCE"; git init -q "$SOURCE"; }
  src config rerere.enabled true
  src config rerere.autoUpdate true
  src config gc.rerereResolved 36500
  src config gc.rerereUnresolved 36500
  mkdir -p "$SOURCE/.git/rr-cache" "$RERERE"
  cp -R "$RERERE/." "$SOURCE/.git/rr-cache/"

  local base upstream
  base="$(git -C "$THORVG" rev-parse HEAD)"
  upstream="$(git -C "$THORVG" remote get-url origin)"
  src cherry-pick --abort 2> /dev/null || true
  src fetch -q "$THORVG" HEAD
  src fetch -q "$upstream" main
  local main
  main="$(src rev-parse FETCH_HEAD)"
  src checkout -q -f --detach "$base"
  src clean -qfdx

  local name url branch sha commit
  while read -r name url branch sha; do
    [ -n "$name" ] || continue
    src cat-file -e "$sha^{commit}" 2> /dev/null || src fetch -q "$url" "$sha"
    echo "  applying $name ($branch@${sha:0:8})"
    for commit in $(src rev-list --reverse --no-merges "$(src merge-base "$main" "$sha")..$sha"); do
      src cherry-pick -X diff-algorithm=histogram "$commit" > /dev/null 2>&1 && continue
      if [ -z "$(src diff --name-only --diff-filter=U)" ] && [ -z "$(src rerere remaining)" ]; then
        src cherry-pick --continue > /dev/null
        continue
      fi
      echo "$(src log -1 --format='%h %s' "$commit") left conflicts that no recorded resolution covers:" >&2
      src diff --name-only --diff-filter=U | sed 's/^/  /' >&2
      echo "Resolve them in $SOURCE, run git add and git cherry-pick --continue there, then run this script again." >&2
      exit 1
    done
  done < "$GPU_ENGINES"

  cp -R "$SOURCE/.git/rr-cache/." "$RERERE/"
}

build_slice() {
  local name="$1" constants="$2" simd="$3" engines="$4" extra="$5"
  shift 5
  local dir="$BUILD/$name"

  rm -rf "$dir"
  mkdir -p "$dir"
  printf '%s\n' "$constants" > "$dir/constants.ini"

  meson setup "$dir/build" "$SOURCE" \
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
  cp "$SOURCE/src/bindings/capi/thorvg_capi.h" "$dest/"
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
    local simd=true engines=cpu,gl,vk
    case "$abi" in x86|x86_64) simd=false ;; esac
    case "$abi" in armeabi-v7a|x86) engines=cpu,gl ;; esac
    echo "  building $abi ($engines)"
    build_slice "android-$abi" "[constants]
toolchain = '$toolchain'
api = '$ANDROID_API'" "$simd" "$engines" lottie_exp,opengl_es
    mkdir -p "$LIBS/android/$abi"
    "$toolchain/llvm-strip" --strip-debug "$BUILD/android-$abi/libthorvg.a" -o "$LIBS/android/$abi/libthorvg.a"
  done
  copy_headers "$LIBS/android/include"
  echo "$VERSION" > "$LIBS/android/VERSION"
}

build_ios() {
  local toolchain iphoneos simulator
  toolchain="$(dirname "$(xcrun -f clang)")"
  iphoneos="$(xcrun --sdk iphoneos --show-sdk-path)"
  simulator="$(xcrun --sdk iphonesimulator --show-sdk-path)"

  for slice in "${IOS_SLICES[@]}"; do
    local simd=true
    case "$slice" in *x86_64) simd=false ;; esac
    echo "  building $slice (cpu,mtl)"
    build_slice "$slice" "[constants]
toolchain = '$toolchain'
ios_min = '$IOS_MIN'
iphoneos_sdk = '$iphoneos'
simulator_sdk = '$simulator'" "$simd" cpu,mtl lottie_exp
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
}

case "$TARGET" in android|ios|all|source) ;; *) echo "Usage: $0 [android|ios|all|source]" >&2; exit 1 ;; esac
echo "ThorVG $VERSION + $(cut -d' ' -f1 "$GPU_ENGINES" | paste -sd, -)"
prepare_source
case "$TARGET" in
  android) build_android ;;
  ios) build_ios ;;
  all) build_android; build_ios ;;
  source) echo "Source: $SOURCE"; exit 0 ;;
  *) echo "Usage: $0 [android|ios|all|source]" >&2; exit 1 ;;
esac
cp "$THORVG/LICENSE" "$LIBS/LICENSE"
echo "Done: $LIBS"
