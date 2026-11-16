#include <ReactCommon/BindingsInstallerHolder.h>
#include <android/native_window_jni.h>
#include <fbjni/fbjni.h>
#include <jsi/jsi.h>

#include <memory>

#include "AndroidSurface.h"
#include "ThorVGBindings.h"

namespace jni = facebook::jni;
namespace jsi = facebook::jsi;
namespace react = facebook::react;

namespace thorvg::rn {

namespace {

struct ThorVGModule : jni::JavaClass<ThorVGModule> {
  static constexpr auto kJavaDescriptor = "Lorg/thorvg/reactnative/ThorVGModule;";

  static void registerNatives() {
    javaClassLocal()->registerNatives({makeNativeMethod("getBindingsInstaller", ThorVGModule::getBindingsInstaller)});
  }

  static jni::local_ref<react::BindingsInstallerHolder::javaobject> getBindingsInstaller(
      jni::alias_ref<ThorVGModule>) {
    return react::BindingsInstallerHolder::newObjectCxxArgs(
        [](jsi::Runtime& runtime, const std::shared_ptr<react::CallInvoker>& callInvoker) {
          install(runtime, callInvoker);
        });
  }
};

struct ThorVGSurfaces : jni::JavaClass<ThorVGSurfaces> {
  static constexpr auto kJavaDescriptor = "Lorg/thorvg/reactnative/ThorVGSurfaces;";

  static void registerNatives() {
    javaClassLocal()->registerNatives({
        makeNativeMethod("nativeAttach", "(ILandroid/view/Surface;)J", ThorVGSurfaces::attach),
        makeNativeMethod("nativeDetach", ThorVGSurfaces::detach),
        makeNativeMethod("nativeSetVisible", ThorVGSurfaces::setVisible),
    });
  }

  static jlong attach(jni::alias_ref<jclass>, jint surfaceId, jni::alias_ref<jobject> surface) {
    auto* window = ANativeWindow_fromSurface(jni::Environment::current(), surface.get());
    if (!window) return 0;
    auto created = std::make_shared<AndroidSurface>(window);
    SurfaceRegistry::shared().attachSurface(surfaceId, created);
    return reinterpret_cast<jlong>(new std::shared_ptr<AndroidSurface>(std::move(created)));
  }

  static void detach(jni::alias_ref<jclass>, jint surfaceId, jlong handle) {
    SurfaceRegistry::shared().detachSurface(surfaceId);
    delete reinterpret_cast<std::shared_ptr<AndroidSurface>*>(handle);
  }

  static void setVisible(jni::alias_ref<jclass>, jint surfaceId, jboolean visible) {
    SurfaceRegistry::shared().setVisible(surfaceId, visible);
  }
};

}

}

JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void*) {
  return jni::initialize(vm, [] {
    thorvg::rn::ThorVGModule::registerNatives();
    thorvg::rn::ThorVGSurfaces::registerNatives();
  });
}
