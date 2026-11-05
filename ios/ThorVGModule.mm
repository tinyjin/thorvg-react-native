#import "ThorVGModule.h"

#import <ReactCommon/RCTTurboModuleWithJSIBindings.h>

#include "ThorVGBindings.h"

@interface ThorVGModule () <RCTTurboModuleWithJSIBindings>
@end

@implementation ThorVGModule

RCT_EXPORT_MODULE(ThorVG)

- (NSNumber *)install
{
  return @YES;
}

- (void)readAsset:(NSString *)uri resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  NSURL *url = [NSURL URLWithString:uri];
  NSString *path = nil;
  if (url.isFileURL) {
    path = url.path;
  } else if (url.scheme == nil) {
    path = [uri isAbsolutePath] ? uri : [[NSBundle mainBundle] pathForResource:uri ofType:nil];
  }

  NSError *error = nil;
  NSData *data = path ? [NSData dataWithContentsOfFile:path options:0 error:&error] : nil;
  NSString *text = data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : nil;
  if (text) {
    resolve(text);
  } else {
    reject(@"E_THORVG_ASSET", [NSString stringWithFormat:@"ThorVG: failed to read asset %@", uri], error);
  }
}

- (void)installJSIBindingsWithRuntime:(facebook::jsi::Runtime &)runtime
                          callInvoker:(const std::shared_ptr<facebook::react::CallInvoker> &)callInvoker
{
  thorvg::rn::install(runtime, callInvoker);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeThorVGSpecJSI>(params);
}

@end
