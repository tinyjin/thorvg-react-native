#include "AndroidSurface.h"

#include <algorithm>
#include <cstring>
#include <vector>

#include "AndroidTicker.h"

namespace thorvg::rn {

namespace {

class GlGpu final : public Gpu {
 public:
  static GlGpu* shared() {
    static GlGpu* gpu = [] {
      auto* instance = new GlGpu();
      if (instance->init()) return instance;
      delete instance;
      return static_cast<GlGpu*>(nullptr);
    }();
    return gpu;
  }

  Renderer renderer() const override { return Renderer::Gl; }

  Tvg_Canvas create(Tvg_Engine_Option option) override { return tvg_glcanvas_create(option); }

  void bind(Surface* surface) override {
    auto* android = static_cast<AndroidSurface*>(surface);
    auto draw = android && android->egl() != EGL_NO_SURFACE ? android->egl() : pbuffer_;
    if (eglGetCurrentContext() == context_ && eglGetCurrentSurface(EGL_DRAW) == draw) return;
    eglMakeCurrent(display_, draw, draw, context_);
  }

  void unbind() override { eglMakeCurrent(display_, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT); }

  void schedule(std::function<void()> task) override {
    {
      std::lock_guard<std::mutex> lock(tasksMutex_);
      tasks_.push_back(std::move(task));
      if (tasks_.size() > 1) return;
    }
    runOnRenderThread([this] { flush(); });
  }

  void release(Tvg_Canvas canvas, std::shared_ptr<Surface> surface) override {
    schedule([this, canvas, surface = std::move(surface)] { Gpu::release(canvas, surface); });
  }

  EGLSurface createSurface(ANativeWindow* window) {
    auto surface = eglCreateWindowSurface(display_, config_, window, nullptr);
    if (surface == EGL_NO_SURFACE) return surface;
    eglMakeCurrent(display_, surface, surface, context_);
    eglSwapInterval(display_, 0);
    return surface;
  }

  void destroySurface(EGLSurface surface) { eglDestroySurface(display_, surface); }

  void swap(EGLSurface surface) { eglSwapBuffers(display_, surface); }

  EGLDisplay display() const { return display_; }
  EGLContext context() const { return context_; }

 private:
  bool init() {
    display_ = eglGetDisplay(EGL_DEFAULT_DISPLAY);
    if (display_ == EGL_NO_DISPLAY || !eglInitialize(display_, nullptr, nullptr)) return false;

    const EGLint configAttribs[] = {
        EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT,
        EGL_SURFACE_TYPE, EGL_WINDOW_BIT | EGL_PBUFFER_BIT,
        EGL_RED_SIZE, 8,
        EGL_GREEN_SIZE, 8,
        EGL_BLUE_SIZE, 8,
        EGL_ALPHA_SIZE, 8,
        EGL_NONE,
    };
    EGLint count = 0;
    if (!eglChooseConfig(display_, configAttribs, &config_, 1, &count) || count == 0) return false;

    const EGLint contextAttribs[] = {EGL_CONTEXT_CLIENT_VERSION, 3, EGL_NONE};
    context_ = eglCreateContext(display_, config_, EGL_NO_CONTEXT, contextAttribs);
    if (context_ == EGL_NO_CONTEXT) return false;

    const EGLint pbufferAttribs[] = {EGL_WIDTH, 1, EGL_HEIGHT, 1, EGL_NONE};
    pbuffer_ = eglCreatePbufferSurface(display_, config_, pbufferAttribs);
    if (pbuffer_ == EGL_NO_SURFACE) {
      eglDestroyContext(display_, context_);
      return false;
    }
    return true;
  }

  // The context is only current while the engine lock is held, so JS calls can run between tasks.
  void flush() {
    std::vector<std::function<void()>> tasks;
    {
      std::lock_guard<std::mutex> lock(tasksMutex_);
      tasks.swap(tasks_);
    }
    for (auto& task : tasks) {
      std::lock_guard<EngineMutex> engine(engineMutex());
      task();
      unbind();
    }
  }

  std::mutex tasksMutex_;
  std::vector<std::function<void()>> tasks_;
  EGLDisplay display_ = EGL_NO_DISPLAY;
  EGLConfig config_ = nullptr;
  EGLContext context_ = EGL_NO_CONTEXT;
  EGLSurface pbuffer_ = EGL_NO_SURFACE;
};

}

Gpu* platformGpu() { return GlGpu::shared(); }

void flushPresented() {}

AndroidSurface::~AndroidSurface() {
  if (egl_ != EGL_NO_SURFACE) GlGpu::shared()->destroySurface(egl_);
  ANativeWindow_release(window_);
}

void AndroidSurface::geometry(uint32_t width, uint32_t height) {
  if (width == width_ && height == height_) return;
  ANativeWindow_setBuffersGeometry(window_, static_cast<int32_t>(width), static_cast<int32_t>(height),
                                   WINDOW_FORMAT_RGBA_8888);
  width_ = width;
  height_ = height;
}

void AndroidSurface::present(const uint32_t* pixels, uint32_t width, uint32_t height) {
  geometry(width, height);

  ANativeWindow_Buffer buffer;
  if (ANativeWindow_lock(window_, &buffer, nullptr) != 0) return;

  auto rows = std::min<uint32_t>(height, static_cast<uint32_t>(buffer.height));
  auto columns = std::min<uint32_t>(width, static_cast<uint32_t>(buffer.width));
  auto* dst = static_cast<uint8_t*>(buffer.bits);
  for (uint32_t y = 0; y < rows; ++y) {
    std::memcpy(dst + static_cast<size_t>(y) * buffer.stride * 4, pixels + static_cast<size_t>(y) * width,
                columns * 4);
  }
  ANativeWindow_unlockAndPost(window_);
}

Tvg_Result AndroidSurface::target(Tvg_Canvas canvas, uint32_t width, uint32_t height) {
  auto* gpu = GlGpu::shared();
  if (!gpu) return TVG_RESULT_NOT_SUPPORTED;

  geometry(width, height);
  if (egl_ == EGL_NO_SURFACE) {
    egl_ = gpu->createSurface(window_);
    if (egl_ == EGL_NO_SURFACE) return TVG_RESULT_INSUFFICIENT_CONDITION;
  }
  gpu->bind(this);
  return tvg_glcanvas_set_target(canvas, gpu->display(), egl_, gpu->context(), 0, width, height,
                                 TVG_COLORSPACE_ABGR8888S);
}

void AndroidSurface::swap() {
  if (egl_ != EGL_NO_SURFACE) GlGpu::shared()->swap(egl_);
}

}
