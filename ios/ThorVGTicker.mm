#include "ThorVGTicker.h"

#import <QuartzCore/QuartzCore.h>

#include <mutex>
#include <vector>

namespace {

std::function<void(double)> gTick;
std::mutex gTasksMutex;
std::vector<std::function<void()>> gTasks;

}

@interface ThorVGTickerThread : NSThread
@property(nonatomic, strong) CADisplayLink *link;
@end

@implementation ThorVGTickerThread

- (void)main
{
  @autoreleasepool {
    self.link = [CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];
    self.link.paused = YES;
    [self.link addToRunLoop:[NSRunLoop currentRunLoop] forMode:NSRunLoopCommonModes];
    while (!self.cancelled) {
      @autoreleasepool {
        [[NSRunLoop currentRunLoop] runMode:NSDefaultRunLoopMode beforeDate:[NSDate distantFuture]];
      }
    }
  }
}

- (void)tick:(CADisplayLink *)link
{
  if (gTick) gTick(link.timestamp);
}

- (void)setActive:(NSNumber *)active
{
  self.link.paused = !active.boolValue;
}

- (void)drain
{
  std::vector<std::function<void()>> tasks;
  {
    std::lock_guard<std::mutex> lock(gTasksMutex);
    tasks.swap(gTasks);
  }
  for (auto &task : tasks) task();
}

@end

namespace thorvg::rn {

namespace {

ThorVGTickerThread *thread()
{
  static ThorVGTickerThread *shared = [] {
    auto *instance = [ThorVGTickerThread new];
    instance.name = @"ThorVG Render";
    instance.qualityOfService = NSQualityOfServiceUserInteractive;
    [instance start];
    return instance;
  }();
  return shared;
}

}

void setTicker(std::function<void(double)> tick)
{
  gTick = std::move(tick);
}

void setTickerActive(bool active)
{
  auto *ticker = thread();
  [ticker performSelector:@selector(setActive:) onThread:ticker withObject:@(active) waitUntilDone:NO];
}

void runOnRenderThread(std::function<void()> task)
{
  {
    std::lock_guard<std::mutex> lock(gTasksMutex);
    gTasks.push_back(std::move(task));
    if (gTasks.size() > 1) return;
  }
  auto *ticker = thread();
  [ticker performSelector:@selector(drain) onThread:ticker withObject:nil waitUntilDone:NO];
}

}
