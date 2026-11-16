#pragma once

#include <array>
#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

#include "thorvg_capi.h"

namespace thorvg::rn {

enum class Renderer { Sw, Gl, Wg };

const char* rendererName(Renderer renderer);
Renderer rendererFromName(const std::string& name);

struct Frame {
  uint32_t width = 0;
  uint32_t height = 0;
};

class Surface {
 public:
  virtual ~Surface() = default;
  virtual void present(const uint32_t* pixels, const Frame& frame) = 0;
  virtual Tvg_Result target(Tvg_Canvas, uint32_t, uint32_t) { return TVG_RESULT_NOT_SUPPORTED; }
  virtual void swap(const Frame&) {}

  // The view is letting go of this surface: no new frame starts on it once this returns. A frame
  // already in flight may still finish, which is safe because the surface keeps its native target
  // referenced.
  void retire() { live_ = false; }
  bool live() const { return live_; }

 private:
  std::atomic<bool> live_{true};
};

class Gpu {
 public:
  virtual ~Gpu() = default;
  virtual Renderer renderer() const = 0;
  virtual Tvg_Canvas create(Tvg_Engine_Option option) = 0;
  virtual void bind(Surface* surface) = 0;
  virtual void unbind() {}
  virtual void schedule(std::function<void()> task);
  virtual void release(Tvg_Canvas canvas, std::shared_ptr<Surface> surface);
};

Gpu* platformGpu();
void flushPresented();

void setScheduler(std::function<void(std::function<void()>)> scheduler);
void runOnJS(std::function<void()> task);
// FIFO so the render thread, which re-locks per task, can't starve JS calls.
class EngineMutex {
 public:
  void lock();
  void unlock();

 private:
  std::mutex mutex_;
  std::condition_variable cv_;
  uint64_t next_ = 0;
  uint64_t serving_ = 0;
  std::thread::id owner_;
  uint32_t depth_ = 0;
};

EngineMutex& engineMutex();

struct PresentTarget;

// Callers hold engineMutex(), except for attach, detach and setVisible, which the UI thread
// calls and which never wait for a draw.
class CanvasHost : public std::enable_shared_from_this<CanvasHost> {
 public:
  CanvasHost(int surfaceId, Tvg_Engine_Option option, Renderer renderer);
  ~CanvasHost();

  CanvasHost(const CanvasHost&) = delete;
  CanvasHost& operator=(const CanvasHost&) = delete;

  int surfaceId() const { return surfaceId_; }
  bool valid() const { return canvas_ != nullptr; }
  Renderer renderer() const { return gpu_ ? gpu_->renderer() : Renderer::Sw; }
  bool visible() const { return visible_; }
  void setVisible(bool visible);

  Tvg_Result resize(uint32_t width, uint32_t height);
  Tvg_Result render();
  Tvg_Result add(Tvg_Paint paint);
  Tvg_Result remove(Tvg_Paint paint);
  Tvg_Result viewport(int32_t x, int32_t y, int32_t w, int32_t h);

  void attach(std::shared_ptr<Surface> surface);
  void detach();

 private:
  void setSurface(std::shared_ptr<Surface> surface);
  void applySurface();
  void submit();
  bool bindTarget();
  void applyViewport();
  void requestFrame();
  void drawFrame();
  Tvg_Result draw();
  Frame frame() const { return {width_, height_}; }
  bool sized() const { return width_ > 0 && height_ > 0; }

  Tvg_Canvas canvas_ = nullptr;
  Gpu* gpu_ = nullptr;
  bool targeted_ = false;
  std::atomic<bool> framePending_{false};
  std::vector<uint32_t> buffer_;
  uint32_t width_ = 0;
  uint32_t height_ = 0;
  std::optional<std::array<int32_t, 4>> viewport_;
  std::atomic<bool> drawn_{false};
  // Owned by the render thread. The UI thread hands over changes through pendingSurface_.
  std::shared_ptr<Surface> surface_;
  std::shared_ptr<Surface> bound_;
  std::mutex pendingMutex_;
  std::optional<std::shared_ptr<Surface>> pendingSurface_;
  std::shared_ptr<PresentTarget> present_;
  int surfaceId_;
  std::atomic<bool> visible_{true};
};

class SurfaceRegistry {
 public:
  static SurfaceRegistry& shared();

  void attachSurface(int surfaceId, std::shared_ptr<Surface> surface);
  void detachSurface(int surfaceId);
  void bindCanvas(int surfaceId, const std::shared_ptr<CanvasHost>& canvas);
  void unbindCanvas(int surfaceId, const CanvasHost* canvas);
  void setVisible(int surfaceId, bool visible);

 private:
  struct Entry {
    std::shared_ptr<Surface> surface;
    std::weak_ptr<CanvasHost> canvas;
    bool visible = true;
  };

  void prune(int surfaceId);

  std::mutex mutex_;
  std::unordered_map<int, Entry> entries_;
};

}
