#pragma once

#include <EGL/egl.h>
#include <android/native_window.h>

#include <cstdint>

#include "ThorVGSurface.h"

namespace thorvg::rn {

class AndroidSurface final : public Surface {
 public:
  explicit AndroidSurface(ANativeWindow* window) : window_(window) {}
  ~AndroidSurface() override;

  void present(const uint32_t* pixels, const Frame& frame) override;
  Tvg_Result target(Tvg_Canvas canvas, uint32_t width, uint32_t height) override;
  Tvg_Result targetVulkan(Tvg_Canvas canvas, uint32_t width, uint32_t height);
  void swap(const Frame&) override;

  EGLSurface egl() const { return egl_; }

 private:
  void geometry(uint32_t width, uint32_t height);

  ANativeWindow* window_;
  EGLSurface egl_ = EGL_NO_SURFACE;
  uint64_t vulkan_ = 0;
  uint32_t width_ = 0;
  uint32_t height_ = 0;
};

}
