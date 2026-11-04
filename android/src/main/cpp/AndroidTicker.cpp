#include "AndroidTicker.h"

#include "ThorVGTicker.h"

#include <android/choreographer.h>
#include <android/looper.h>
#include <fbjni/fbjni.h>
#include <pthread.h>
#include <time.h>

#include <algorithm>
#include <array>
#include <atomic>
#include <mutex>
#include <thread>
#include <vector>

namespace thorvg::rn {

namespace {

std::function<void(double)> gTick;
std::atomic<bool> gActive{false};
std::atomic<ALooper*> gLooper{nullptr};
bool gPosted = false;
int64_t gVsync = 0;
int64_t gDue = 0;
int64_t gWork = 0;
int64_t gLastVsync = 0;
std::array<int64_t, 4> gIntervals{};
size_t gInterval = 0;
std::mutex gTasksMutex;
std::vector<std::function<void()>> gTasks;

void frame(long frameTimeNanos, void*);

void post() {
  if (gPosted || !gActive) return;
  gPosted = true;
  AChoreographer_postFrameCallback(AChoreographer_getInstance(), frame, nullptr);
}

int64_t now() {
  timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return static_cast<int64_t>(ts.tv_sec) * 1000000000 + ts.tv_nsec;
}

int64_t period() {
  int64_t shortest = 0;
  for (auto interval : gIntervals) {
    if (interval > 0 && (shortest == 0 || interval < shortest)) shortest = interval;
  }
  return shortest;
}

void frame(long frameTimeNanos, void*) {
  gPosted = false;
  if (!gActive) return;
  auto interval = frameTimeNanos - gLastVsync;
  if (gLastVsync > 0 && interval < 100000000) gIntervals[gInterval++ % gIntervals.size()] = interval;
  gLastVsync = frameTimeNanos;
  gVsync = frameTimeNanos;
  gDue = frameTimeNanos + std::max<int64_t>(0, period() / 2 - gWork);
}

void drain();

void tick() {
  auto begin = now();
  auto vsync = gVsync;
  gDue = 0;
  if (gTick) gTick(static_cast<double>(vsync) / 1e9);
  drain();
  gWork = now() - begin;
}

void drain() {
  std::vector<std::function<void()>> tasks;
  {
    std::lock_guard<std::mutex> lock(gTasksMutex);
    tasks.swap(gTasks);
  }
  for (auto& task : tasks) task();
}

void start() {
  static std::once_flag once;
  std::call_once(once, [] {
    std::thread([] {
      facebook::jni::Environment::ensureCurrentThreadIsAttached();
      pthread_setname_np(pthread_self(), "ThorVG Render");
      auto* looper = ALooper_prepare(0);
      ALooper_acquire(looper);
      gLooper = looper;
      while (true) {
        auto timeout = -1;
        if (gDue > 0) timeout = static_cast<int>(std::max<int64_t>(0, gDue - now() + 999999) / 1000000);
        ALooper_pollOnce(timeout, nullptr, nullptr, nullptr);
        if (gDue > 0 && now() >= gDue) tick();
        drain();
        post();
      }
    }).detach();
  });
  while (!gLooper) std::this_thread::yield();
}

}

void runOnRenderThread(std::function<void()> task) {
  {
    std::lock_guard<std::mutex> lock(gTasksMutex);
    gTasks.push_back(std::move(task));
  }
  start();
  ALooper_wake(gLooper);
}

void setTicker(std::function<void(double)> tick) {
  gTick = std::move(tick);
}

void setTickerActive(bool active) {
  gActive = active;
  if (!active) return;
  start();
  ALooper_wake(gLooper);
}

}
