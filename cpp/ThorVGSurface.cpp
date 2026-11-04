#include "ThorVGSurface.h"

#include <algorithm>
#include <atomic>
#include <condition_variable>
#include <deque>
#include <thread>

#include "ThorVGPlayer.h"

namespace thorvg::rn {

#if defined(__APPLE__)
static constexpr Tvg_Colorspace kColorspace = TVG_COLORSPACE_ARGB8888;
#else
static constexpr Tvg_Colorspace kColorspace = TVG_COLORSPACE_ABGR8888;
#endif

namespace {

std::mutex gSchedulerMutex;
std::function<void(std::function<void()>)> gScheduler;

}

// Presents sw frames on the presenter thread. Only the latest pending frame is shown.
struct PresentTarget {
  std::mutex mutex;
  std::shared_ptr<Surface> surface;
  std::vector<uint32_t> back;
  std::vector<uint32_t> front;
  uint32_t width = 0;
  uint32_t height = 0;
  uint32_t frontWidth = 0;
  uint32_t frontHeight = 0;
  bool dirty = false;
  bool repaint = false;
  std::atomic<bool> queued{false};

  void present() {
    std::shared_ptr<Surface> target;
    {
      std::lock_guard<std::mutex> lock(mutex);
      if (!surface) return;
      if (dirty) {
        back.swap(front);
        frontWidth = width;
        frontHeight = height;
        dirty = false;
      } else if (!repaint || front.empty()) {
        return;
      }
      repaint = false;
      target = surface;
    }
    target->present(front.data(), frontWidth, frontHeight);
  }
};

namespace {

class Presenter {
 public:
  static Presenter& shared() {
    static Presenter* presenter = new Presenter();
    return *presenter;
  }

  void schedule(const std::shared_ptr<PresentTarget>& target) {
    if (target->queued.exchange(true)) return;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      queue_.push_back(target);
    }
    cv_.notify_one();
  }

 private:
  Presenter() {
    std::thread([this] {
      while (true) {
        std::deque<std::shared_ptr<PresentTarget>> batch;
        {
          std::unique_lock<std::mutex> lock(mutex_);
          cv_.wait(lock, [this] { return !queue_.empty(); });
          batch.swap(queue_);
        }
        for (auto& target : batch) {
          target->queued = false;
          target->present();
        }
        flushPresented();
      }
    }).detach();
  }

  std::mutex mutex_;
  std::condition_variable cv_;
  std::deque<std::shared_ptr<PresentTarget>> queue_;
};

}

const char* rendererName(Renderer renderer) {
  switch (renderer) {
    case Renderer::Gl:
      return "gl";
    case Renderer::Wg:
      return "wg";
    default:
      return "sw";
  }
}

Renderer rendererFromName(const std::string& name) {
  if (name == "gl") return Renderer::Gl;
  if (name == "wg") return Renderer::Wg;
  return Renderer::Sw;
}

void setScheduler(std::function<void(std::function<void()>)> scheduler) {
  std::lock_guard<std::mutex> lock(gSchedulerMutex);
  gScheduler = std::move(scheduler);
}

void runOnJS(std::function<void()> task) {
  std::lock_guard<std::mutex> lock(gSchedulerMutex);
  if (gScheduler) gScheduler(std::move(task));
}

std::recursive_mutex& engineMutex() {
  static std::recursive_mutex mutex;
  return mutex;
}

void Gpu::schedule(std::function<void()> task) { runOnJS(std::move(task)); }

void Gpu::release(Tvg_Canvas canvas, std::shared_ptr<Surface> surface) {
  bind(surface.get());
  tvg_canvas_sync(canvas);
  tvg_canvas_destroy(canvas);
}

CanvasHost::CanvasHost(int surfaceId, Tvg_Engine_Option option, Renderer renderer) : surfaceId_(surfaceId) {
  auto* gpu = renderer == Renderer::Sw ? nullptr : platformGpu();
  if (gpu && gpu->renderer() == renderer) {
    gpu->bind(nullptr);
    canvas_ = gpu->create(option);
    gpu->unbind();
    if (canvas_) gpu_ = gpu;
  }
  if (!canvas_) {
    canvas_ = tvg_swcanvas_create(option);
    present_ = std::make_shared<PresentTarget>();
  }
}

CanvasHost::~CanvasHost() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (canvas_) {
    if (gpu_) {
      gpu_->release(canvas_, surface_);
    } else {
      tvg_canvas_sync(canvas_);
      tvg_canvas_destroy(canvas_);
    }
    canvas_ = nullptr;
  }
  surface_.reset();
  bound_.reset();
  if (present_) {
    std::lock_guard<std::mutex> target(present_->mutex);
    present_->surface.reset();
  }
}

Tvg_Result CanvasHost::resize(uint32_t width, uint32_t height) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!canvas_) return TVG_RESULT_INSUFFICIENT_CONDITION;
  width = std::max(width, 1u);
  height = std::max(height, 1u);
  if (width == width_ && height == height_) return TVG_RESULT_SUCCESS;

  width_ = width;
  height_ = height;
  if (gpu_) {
    targeted_ = false;
    return TVG_RESULT_SUCCESS;
  }

  tvg_canvas_sync(canvas_);
  buffer_.assign(static_cast<size_t>(width) * height, 0);
  drawn_ = false;
  auto result = tvg_swcanvas_set_target(canvas_, buffer_.data(), width, width, height, kColorspace);
  if (result == TVG_RESULT_SUCCESS) applyViewportLocked();
  return result;
}

Tvg_Result CanvasHost::render() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!canvas_) return TVG_RESULT_INSUFFICIENT_CONDITION;

  if (gpu_) {
    drawn_ = true;
    requestFrameLocked();
    return TVG_RESULT_SUCCESS;
  }

  if (buffer_.empty()) return TVG_RESULT_INSUFFICIENT_CONDITION;
  auto result = tvg_canvas_draw(canvas_, true);
  tvg_canvas_sync(canvas_);
  drawn_ = true;
  submitLocked();
  return result;
}

Tvg_Result CanvasHost::renderNow() {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!canvas_) return TVG_RESULT_INSUFFICIENT_CONDITION;
    if (gpu_ && gpu_->renderer() != Renderer::Gl) {
      drawn_ = true;
      if (!bindLocked()) return TVG_RESULT_SUCCESS;
      tvg_canvas_update(canvas_);
      tvg_canvas_draw(canvas_, true);
      tvg_canvas_sync(canvas_);
      surface_->swap();
      return TVG_RESULT_SUCCESS;
    }
  }
  return render();
}

Tvg_Result CanvasHost::add(Tvg_Paint paint) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!canvas_) return TVG_RESULT_INSUFFICIENT_CONDITION;
  return tvg_canvas_add(canvas_, paint);
}

Tvg_Result CanvasHost::remove(Tvg_Paint paint) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!canvas_) return TVG_RESULT_INSUFFICIENT_CONDITION;
  return tvg_canvas_remove(canvas_, paint);
}

Tvg_Result CanvasHost::update() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!canvas_) return TVG_RESULT_INSUFFICIENT_CONDITION;
  if (gpu_) return TVG_RESULT_SUCCESS;
  return tvg_canvas_update(canvas_);
}

Tvg_Result CanvasHost::viewport(int32_t x, int32_t y, int32_t w, int32_t h) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!canvas_) return TVG_RESULT_INSUFFICIENT_CONDITION;
  viewport_ = {x, y, w, h};
  return tvg_canvas_set_viewport(canvas_, x, y, w, h);
}

void CanvasHost::applyViewportLocked() {
  if (viewport_) tvg_canvas_set_viewport(canvas_, (*viewport_)[0], (*viewport_)[1], (*viewport_)[2], (*viewport_)[3]);
}

void CanvasHost::attach(std::shared_ptr<Surface> surface) {
  std::lock_guard<std::mutex> lock(mutex_);
  surface_ = std::move(surface);
  if (!gpu_) {
    {
      std::lock_guard<std::mutex> target(present_->mutex);
      present_->surface = surface_;
      present_->repaint = true;
    }
    Presenter::shared().schedule(present_);
    return;
  }

  targeted_ = false;
  if (drawn_) requestFrameLocked();
}

void CanvasHost::detach() {
  std::lock_guard<std::mutex> lock(mutex_);
  surface_.reset();
  targeted_ = false;
  if (present_) {
    std::lock_guard<std::mutex> target(present_->mutex);
    present_->surface.reset();
  }
}

void CanvasHost::setVisible(bool visible) {
  if (visible_.exchange(visible) == visible) return;
  if (visible) wakePlayers();
}

void CanvasHost::submitLocked() {
  {
    std::lock_guard<std::mutex> target(present_->mutex);
    present_->back.assign(buffer_.begin(), buffer_.end());
    present_->width = width_;
    present_->height = height_;
    present_->dirty = true;
  }
  Presenter::shared().schedule(present_);
}

void CanvasHost::requestFrameLocked() {
  if (framePending_) return;
  framePending_ = true;
  gpu_->schedule([weak = weak_from_this()] {
    if (auto host = weak.lock()) host->drawFrame();
  });
}

void CanvasHost::drawFrame() {
  std::lock_guard<std::recursive_mutex> engine(engineMutex());
  std::lock_guard<std::mutex> lock(mutex_);
  framePending_ = false;
  if (!canvas_ || !bindLocked()) return;
  tvg_canvas_update(canvas_);
  tvg_canvas_draw(canvas_, true);
  tvg_canvas_sync(canvas_);
  surface_->swap();
}

bool CanvasHost::bindLocked() {
  if (!gpu_) return true;
  gpu_->bind(surface_.get());
  if (!surface_ || width_ == 0 || height_ == 0) return false;
  if (!targeted_) {
    tvg_canvas_sync(canvas_);
    targeted_ = surface_->target(canvas_, width_, height_) == TVG_RESULT_SUCCESS;
    if (!targeted_) return false;
    bound_ = surface_;
    applyViewportLocked();
  }
  return targeted_;
}

SurfaceRegistry& SurfaceRegistry::shared() {
  static SurfaceRegistry registry;
  return registry;
}

void SurfaceRegistry::attachSurface(int surfaceId, std::shared_ptr<Surface> surface) {
  std::lock_guard<std::mutex> lock(mutex_);
  auto& entry = entries_[surfaceId];
  entry.surface = std::move(surface);
  if (auto canvas = entry.canvas.lock()) canvas->attach(entry.surface);
}

void SurfaceRegistry::detachSurface(int surfaceId) {
  std::lock_guard<std::mutex> lock(mutex_);
  auto it = entries_.find(surfaceId);
  if (it == entries_.end()) return;
  if (auto canvas = it->second.canvas.lock()) canvas->detach();
  it->second.surface.reset();
  prune(surfaceId);
}

void SurfaceRegistry::bindCanvas(int surfaceId, const std::shared_ptr<CanvasHost>& canvas) {
  std::lock_guard<std::mutex> lock(mutex_);
  auto& entry = entries_[surfaceId];
  entry.canvas = canvas;
  canvas->setVisible(entry.visible);
  if (entry.surface) canvas->attach(entry.surface);
}

void SurfaceRegistry::unbindCanvas(int surfaceId, const CanvasHost* canvas) {
  std::lock_guard<std::mutex> lock(mutex_);
  auto it = entries_.find(surfaceId);
  if (it == entries_.end()) return;
  auto current = it->second.canvas.lock();
  if (current && current.get() != canvas) return;
  it->second.canvas.reset();
  prune(surfaceId);
}

void SurfaceRegistry::setVisible(int surfaceId, bool visible) {
  std::shared_ptr<CanvasHost> canvas;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = entries_.find(surfaceId);
    if (it == entries_.end() && visible) return;
    auto& entry = it == entries_.end() ? entries_[surfaceId] : it->second;
    entry.visible = visible;
    canvas = entry.canvas.lock();
  }
  if (canvas) canvas->setVisible(visible);
}

void SurfaceRegistry::prune(int surfaceId) {
  auto it = entries_.find(surfaceId);
  if (it != entries_.end() && !it->second.surface && it->second.canvas.expired()) {
    entries_.erase(it);
  }
}

}
