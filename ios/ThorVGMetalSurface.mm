#import "ThorVGMetalSurface.h"

#import <CoreVideo/CVPixelBuffer.h>
#import <IOSurface/IOSurfaceRef.h>
#import <Metal/Metal.h>

#include <array>
#include <cstring>

namespace thorvg::rn {

namespace {

class MtlGpu final : public Gpu {
 public:
  static MtlGpu *shared()
  {
    static MtlGpu *gpu = [] {
      id<MTLDevice> device = MTLCreateSystemDefaultDevice();
      id<MTLCommandQueue> queue = [device newCommandQueue];
      return device && queue ? new MtlGpu(device, queue) : static_cast<MtlGpu *>(nullptr);
    }();
    return gpu;
  }

  Renderer renderer() const override { return Renderer::Mtl; }

  Tvg_Canvas create(Tvg_Engine_Option option) override { return tvg_mtlcanvas_create(option); }

  void bind(Surface *) override {}

  Tvg_Result target(Surface *surface, Tvg_Canvas canvas, uint32_t width, uint32_t height) override;

  id<MTLDevice> device() const { return device_; }
  id<MTLCommandQueue> queue() const { return queue_; }

 private:
  MtlGpu(id<MTLDevice> device, id<MTLCommandQueue> queue) : device_(device), queue_(queue) {}

  id<MTLDevice> device_;
  id<MTLCommandQueue> queue_;
};

class LayerSurface final : public Surface {
 public:
  LayerSurface(CALayer *layer, CAMetalLayer *metalLayer) : layer_(layer), metalLayer_(metalLayer)
  {
    layer_.actions = @{@"contents" : [NSNull null]};
  }

  Tvg_Result targetMetal(MtlGpu *gpu, Tvg_Canvas canvas, uint32_t width, uint32_t height)
  {
    auto result = tvg_mtlcanvas_set_target(canvas, (__bridge void *)gpu->device(), (__bridge void *)gpu->queue(),
                                           (__bridge void *)metalLayer_, width, height, TVG_COLORSPACE_ABGR8888, 0);
    if (result == TVG_RESULT_SUCCESS && !metalShown_) {
      metalShown_ = true;
      CAMetalLayer *metalLayer = metalLayer_;
      dispatch_async(dispatch_get_main_queue(), ^{
        metalLayer.hidden = NO;
      });
    }
    return result;
  }

  void present(const uint32_t *pixels, const Frame &frame) override
  {
    @autoreleasepool {
      IOSurfaceRef surface = acquire(frame.width, frame.height);
      if (!surface) return;

      IOSurfaceLock(surface, 0, nullptr);
      auto *dst = static_cast<uint8_t *>(IOSurfaceGetBaseAddress(surface));
      auto stride = IOSurfaceGetBytesPerRow(surface);
      for (uint32_t y = 0; y < frame.height; ++y) {
        std::memcpy(dst + y * stride, pixels + static_cast<size_t>(y) * frame.width,
                    static_cast<size_t>(frame.width) * 4);
      }
      IOSurfaceUnlock(surface, 0, nullptr);

      show(layer_, (__bridge id)surface);
      current_ = surface;
    }
  }

 private:
  static void show(CALayer *layer, id contents)
  {
    [CATransaction begin];
    [CATransaction setDisableActions:YES];
    layer.contents = contents;
    [CATransaction commit];
  }

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
  bool metalShown_ = false;
};

Tvg_Result MtlGpu::target(Surface *surface, Tvg_Canvas canvas, uint32_t width, uint32_t height)
{
  return static_cast<LayerSurface *>(surface)->targetMetal(this, canvas, width, height);
}

}

void flushPresented()
{
  [CATransaction flush];
}

Gpu *platformGpu(Renderer renderer)
{
  return renderer == Renderer::Mtl ? MtlGpu::shared() : nullptr;
}

std::shared_ptr<Surface> makeLayerSurface(CALayer *layer, CAMetalLayer *metalLayer)
{
  return std::make_shared<LayerSurface>(layer, metalLayer);
}

}
