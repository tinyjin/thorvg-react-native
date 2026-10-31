#import "ThorVGMetalSurface.h"

#if THORVG_RN_WEBGPU
#import <webgpu/webgpu.h>
#endif

#import <CoreVideo/CVPixelBuffer.h>
#import <IOSurface/IOSurfaceRef.h>

#include <array>
#include <cstring>

namespace thorvg::rn {

namespace {

#if THORVG_RN_WEBGPU
class WgGpu final : public Gpu {
 public:
  static WgGpu *shared()
  {
    static WgGpu *gpu = [] {
      auto *instance = new WgGpu();
      if (instance->init()) return instance;
      delete instance;
      return static_cast<WgGpu *>(nullptr);
    }();
    return gpu;
  }

  Renderer renderer() const override { return Renderer::Wg; }

  Tvg_Canvas create(Tvg_Engine_Option option) override { return tvg_wgcanvas_create(option); }

  void bind(Surface *) override {}

  WGPUSurface createSurface(CAMetalLayer *layer)
  {
    WGPUSurfaceSourceMetalLayer source = {};
    source.chain.sType = WGPUSType_SurfaceSourceMetalLayer;
    source.layer = (__bridge void *)layer;
    WGPUSurfaceDescriptor descriptor = {};
    descriptor.nextInChain = &source.chain;
    return wgpuInstanceCreateSurface(instance_, &descriptor);
  }

  Tvg_WgContext context() const { return {instance_, adapter_, device_}; }

 private:
  bool init()
  {
    instance_ = wgpuCreateInstance(nullptr);
    if (!instance_) return false;

    WGPURequestAdapterOptions adapterOptions = {};
    adapterOptions.powerPreference = WGPUPowerPreference_HighPerformance;
    WGPURequestAdapterCallbackInfo adapterCallback = {};
    adapterCallback.mode = WGPUCallbackMode_AllowSpontaneous;
    adapterCallback.callback = [](WGPURequestAdapterStatus status, WGPUAdapter adapter, WGPUStringView, void *out, void *) {
      if (status == WGPURequestAdapterStatus_Success) *static_cast<WGPUAdapter *>(out) = adapter;
    };
    adapterCallback.userdata1 = &adapter_;
    wgpuInstanceRequestAdapter(instance_, &adapterOptions, adapterCallback);
    if (!adapter_) return false;

    WGPUDeviceDescriptor deviceDescriptor = {};
    deviceDescriptor.uncapturedErrorCallbackInfo.callback = [](WGPUDevice const *, WGPUErrorType, WGPUStringView message,
                                                               void *, void *) {
      NSLog(@"[ThorVG] WebGPU error: %.*s", static_cast<int>(message.length), message.data);
    };
    WGPURequestDeviceCallbackInfo deviceCallback = {};
    deviceCallback.mode = WGPUCallbackMode_AllowSpontaneous;
    deviceCallback.callback = [](WGPURequestDeviceStatus status, WGPUDevice device, WGPUStringView, void *out, void *) {
      if (status == WGPURequestDeviceStatus_Success) *static_cast<WGPUDevice *>(out) = device;
    };
    deviceCallback.userdata1 = &device_;
    wgpuAdapterRequestDevice(adapter_, &deviceDescriptor, deviceCallback);
    return device_ != nullptr;
  }

  WGPUInstance instance_ = nullptr;
  WGPUAdapter adapter_ = nullptr;
  WGPUDevice device_ = nullptr;
};
#endif

class LayerSurface final : public Surface {
 public:
  LayerSurface(CALayer *layer, CAMetalLayer *metalLayer) : layer_(layer), metalLayer_(metalLayer)
  {
    layer_.actions = @{@"contents" : [NSNull null]};
  }

#if THORVG_RN_WEBGPU
  ~LayerSurface() override
  {
    if (wgSurface_) wgpuSurfaceRelease(wgSurface_);
  }
#endif

#if THORVG_RN_WEBGPU
  Tvg_Result target(Tvg_Canvas canvas, uint32_t width, uint32_t height) override
  {
    auto *gpu = WgGpu::shared();
    if (!gpu) return TVG_RESULT_NOT_SUPPORTED;
    if (!wgSurface_) {
      wgSurface_ = gpu->createSurface(metalLayer_);
      if (!wgSurface_) return TVG_RESULT_INSUFFICIENT_CONDITION;
      CAMetalLayer *metalLayer = metalLayer_;
      dispatch_async(dispatch_get_main_queue(), ^{
        metalLayer.hidden = NO;
      });
    }
    auto context = gpu->context();
    return tvg_wgcanvas_set_target_with_context(canvas, &context, wgSurface_, width, height, TVG_COLORSPACE_ABGR8888, 0);
  }

  void swap() override
  {
    if (wgSurface_) wgpuSurfacePresent(wgSurface_);
  }
#endif

  void present(const uint32_t *pixels, uint32_t width, uint32_t height) override
  {
    @autoreleasepool {
      IOSurfaceRef surface = acquire(width, height);
      if (!surface) return;

      IOSurfaceLock(surface, 0, nullptr);
      auto *dst = static_cast<uint8_t *>(IOSurfaceGetBaseAddress(surface));
      auto stride = IOSurfaceGetBytesPerRow(surface);
      for (uint32_t y = 0; y < height; ++y) {
        std::memcpy(dst + y * stride, pixels + static_cast<size_t>(y) * width, static_cast<size_t>(width) * 4);
      }
      IOSurfaceUnlock(surface, 0, nullptr);

      layer_.contents = (__bridge id)surface;
      current_ = surface;
    }
  }

 private:
  IOSurfaceRef acquire(uint32_t width, uint32_t height)
  {
    if (width == 0 || height == 0) return nullptr;
    if (width != width_ || height != height_) {
      surfaces_ = {};
      current_ = nullptr;
      width_ = width;
      height_ = height;
    }
    IOSurfaceRef fallback = nullptr;
    for (auto &surface : surfaces_) {
      if (!surface) {
        surface = CFBridgingRelease(create(width, height));
        return (__bridge IOSurfaceRef)surface;
      }
      auto ref = (__bridge IOSurfaceRef)surface;
      if (ref == current_) continue;
      if (!IOSurfaceIsInUse(ref)) return ref;
      fallback = ref;
    }
    return fallback;
  }

  static IOSurfaceRef create(uint32_t width, uint32_t height)
  {
    NSDictionary *properties = @{
      (id)kIOSurfaceWidth : @(width),
      (id)kIOSurfaceHeight : @(height),
      (id)kIOSurfaceBytesPerElement : @4,
      (id)kIOSurfacePixelFormat : @(kCVPixelFormatType_32BGRA),
    };
    return IOSurfaceCreate((__bridge CFDictionaryRef)properties);
  }

  CALayer *layer_;
  CAMetalLayer *metalLayer_;
  std::array<id, 3> surfaces_{};
  IOSurfaceRef current_ = nullptr;
  uint32_t width_ = 0;
  uint32_t height_ = 0;
#if THORVG_RN_WEBGPU
  WGPUSurface wgSurface_ = nullptr;
#endif
};

}

void flushPresented()
{
  [CATransaction flush];
}

Gpu *platformGpu()
{
#if THORVG_RN_WEBGPU
  return WgGpu::shared();
#else
  return nullptr;
#endif
}

std::shared_ptr<Surface> makeLayerSurface(CALayer *layer, CAMetalLayer *metalLayer)
{
  return std::make_shared<LayerSurface>(layer, metalLayer);
}

}
