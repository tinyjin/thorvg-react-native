#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

#include "thorvg_capi.h"

namespace thorvg::rn {

enum class Renderer { Sw, Gl, Wg };

const char* rendererName(Renderer renderer);
Renderer rendererFromName(const std::string& name);

class Surface {
 public:
  virtual ~Surface() = default;
  virtual void present(const uint32_t* pixels, uint32_t width, uint32_t height) = 0;
  virtual Tvg_Result target(Tvg_Canvas, uint32_t, uint32_t) { return TVG_RESULT_NOT_SUPPORTED; }
  virtual void swap() {}
};

class Gpu {
 public:
  virtual ~Gpu() = default;
  virtual Renderer renderer() const = 0;
  virtual Tvg_Canvas create(Tvg_Engine_Option option) = 0;
  virtual void bind(Surface* surface) = 0;
};

Gpu* platformGpu();
void flushPresented();

void setScheduler(std::function<void(std::function<void()>)> scheduler);
void runOnJS(std::function<void()> task);
std::recursive_mutex& engineMutex();

struct PresentTarget;

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
  Tvg_Result renderNow();
  Tvg_Result add(Tvg_Paint paint);
  Tvg_Result remove(Tvg_Paint paint);
  Tvg_Result update();
  Tvg_Result viewport(int32_t x, int32_t y, int32_t w, int32_t h);

  void attach(std::shared_ptr<Surface> surface);
  void detach();

 private:
  void submitLocked();
  bool bindLocked();
  void requestFrameLocked();
  void drawFrame();

  std::mutex mutex_;
  Tvg_Canvas canvas_ = nullptr;
  Gpu* gpu_ = nullptr;
  bool targeted_ = false;
  bool framePending_ = false;
  std::vector<uint32_t> buffer_;
  uint32_t width_ = 0;
  uint32_t height_ = 0;
  bool drawn_ = false;
  std::shared_ptr<Surface> surface_;
  std::shared_ptr<Surface> bound_;
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
