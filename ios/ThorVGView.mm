#import "ThorVGView.h"

#import <Metal/Metal.h>
#import <QuartzCore/CAMetalLayer.h>

#import <react/renderer/components/ReactNativeThorVGSpec/ComponentDescriptors.h>
#import <react/renderer/components/ReactNativeThorVGSpec/Props.h>
#import <react/renderer/components/ReactNativeThorVGSpec/RCTComponentViewHelpers.h>

#include "ThorVGMetalSurface.h"
#include "ThorVGSurface.h"

using namespace facebook::react;

@interface ThorVGMetalView : UIView
@end

@implementation ThorVGMetalView

+ (Class)layerClass
{
  return [CAMetalLayer class];
}

@end

static void *kScrollContext = &kScrollContext;

static NSHashTable *gTracked;
static NSTimer *gRecheckTimer;

@implementation ThorVGView {
  ThorVGMetalView *_metalView;
  int _surfaceId;
  BOOL _visible;
  BOOL _background;
  NSArray<UIScrollView *> *_scrollViews;
}

+ (void)track:(ThorVGView *)view
{
  if (!gTracked) gTracked = [NSHashTable weakObjectsHashTable];
  [gTracked addObject:view];
  if (gRecheckTimer) return;
  gRecheckTimer = [NSTimer timerWithTimeInterval:0.25
                                         repeats:YES
                                           block:^(NSTimer *timer) {
                                             NSArray<ThorVGView *> *views = gTracked.allObjects;
                                             for (ThorVGView *tracked in views) [tracked updateVisibility];
                                             if (views.count > 0) return;
                                             [timer invalidate];
                                             gRecheckTimer = nil;
                                           }];
  [NSRunLoop.mainRunLoop addTimer:gRecheckTimer forMode:NSRunLoopCommonModes];
}

+ (void)untrack:(ThorVGView *)view
{
  [gTracked removeObject:view];
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<ThorVGViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const ThorVGViewProps>();
    _props = defaultProps;

    _metalView = [[ThorVGMetalView alloc] initWithFrame:self.bounds];
    _metalView.userInteractionEnabled = NO;
    _metalView.backgroundColor = UIColor.clearColor;

    CAMetalLayer *layer = (CAMetalLayer *)_metalView.layer;
    layer.device = MTLCreateSystemDefaultDevice();
    layer.pixelFormat = MTLPixelFormatBGRA8Unorm;
    layer.framebufferOnly = NO;
    layer.opaque = NO;

    self.contentView = _metalView;

    _visible = YES;
    _background = UIApplication.sharedApplication.applicationState == UIApplicationStateBackground;
    NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
    [center addObserver:self
               selector:@selector(didEnterBackground)
                   name:UIApplicationDidEnterBackgroundNotification
                 object:nil];
    [center addObserver:self
               selector:@selector(willEnterForeground)
                   name:UIApplicationWillEnterForegroundNotification
                 object:nil];
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newProps = *std::static_pointer_cast<ThorVGViewProps const>(props);
  if (newProps.surfaceId != _surfaceId) {
    [self detachSurface];
    _surfaceId = newProps.surfaceId;
    [self attachSurface];
  }
  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle
{
  [self detachSurface];
  _surfaceId = 0;
  [super prepareForRecycle];
}

- (void)dealloc
{
  [self unobserveScrollViews];
  [self detachSurface];
}

- (void)updateLayoutMetrics:(LayoutMetrics const &)layoutMetrics
           oldLayoutMetrics:(LayoutMetrics const &)oldLayoutMetrics
{
  [super updateLayoutMetrics:layoutMetrics oldLayoutMetrics:oldLayoutMetrics];
  [self updateVisibility];
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  [self unobserveScrollViews];
  if (self.window) {
    [self observeScrollViews];
    [ThorVGView track:self];
  } else {
    [ThorVGView untrack:self];
  }
  [self updateVisibility];
}

- (void)didEnterBackground
{
  _background = YES;
  [self updateVisibility];
}

- (void)willEnterForeground
{
  _background = NO;
  [self updateVisibility];
}

- (void)observeScrollViews
{
  NSMutableArray<UIScrollView *> *scrollViews = [NSMutableArray new];
  for (UIView *view = self.superview; view; view = view.superview) {
    if (![view isKindOfClass:UIScrollView.class]) continue;
    [view addObserver:self forKeyPath:@"contentOffset" options:0 context:kScrollContext];
    [scrollViews addObject:(UIScrollView *)view];
  }
  _scrollViews = scrollViews;
}

- (void)unobserveScrollViews
{
  for (UIScrollView *view in _scrollViews) {
    [view removeObserver:self forKeyPath:@"contentOffset" context:kScrollContext];
  }
  _scrollViews = nil;
}

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary<NSKeyValueChangeKey, id> *)change
                       context:(void *)context
{
  if (context != kScrollContext) {
    [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
    return;
  }
  [self updateVisibility];
}

- (BOOL)isOnScreen
{
  if (_background || !self.window) return NO;
  CGRect rect = [self convertRect:self.bounds toView:nil];
  for (UIView *view = self; view; view = view.superview) {
    if (view.hidden) return NO;
    if (view != self && view.clipsToBounds) {
      rect = CGRectIntersection(rect, [view convertRect:view.bounds toView:nil]);
    }
  }
  return !CGRectIsEmpty(CGRectIntersection(rect, self.window.bounds));
}

- (void)updateVisibility
{
  BOOL visible = [self isOnScreen];
  if (visible == _visible) return;
  _visible = visible;
  [self reportVisibility];
}

- (void)reportVisibility
{
  if (_surfaceId == 0) return;
  thorvg::rn::SurfaceRegistry::shared().setVisible(_surfaceId, _visible);
}

- (void)attachSurface
{
  if (_surfaceId == 0) return;
  thorvg::rn::SurfaceRegistry::shared().attachSurface(_surfaceId,
                                                      thorvg::rn::makeMetalSurface((CAMetalLayer *)_metalView.layer));
  _visible = [self isOnScreen];
  [self reportVisibility];
}

- (void)detachSurface
{
  if (_surfaceId == 0) return;
  thorvg::rn::SurfaceRegistry::shared().detachSurface(_surfaceId);
}

@end
