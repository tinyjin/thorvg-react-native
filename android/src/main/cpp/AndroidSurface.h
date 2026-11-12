#pragma once

#include <EGL/egl.h>
#include <android/native_window.h>

#include <atomic>
#include <cstdint>

#include "ThorVGSurface.h"

namespace thorvg::rn {

class AndroidSurface final : public Surface {
 public:
  explicit AndroidSurface(ANativeWindow* window) : window_(window) {}
  ~AndroidSurface() override;

  void present(const uint32_t* pixels, const Frame& frame) override;
  Tvg_Result target(Tvg_Canvas canvas, uint32_t width, uint32_t height) override;
  void swap(const Frame& frame) override;

  EGLSurface egl() const { return egl_; }
  uint64_t presentedLayout() const { return layout_.load(); }

 private:
  void geometry(uint32_t width, uint32_t height);
  void presented(const Frame& frame);

  ANativeWindow* window_;
  EGLSurface egl_ = EGL_NO_SURFACE;
  uint32_t width_ = 0;
  uint32_t height_ = 0;
  std::atomic<uint64_t> layout_{0};
};

}
