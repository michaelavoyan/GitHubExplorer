#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Exposes the Swift ConnectivityModule (ConnectivityModule.swift) to the RN
// bridge. RCT_EXTERN_MODULE/RCT_EXTERN_METHOD are Objective-C macros — a
// Swift class can only register with the classic bridge through a
// companion .m file like this one (or Codegen, which this project doesn't
// use since New Architecture is disabled).
@interface RCT_EXTERN_MODULE(ConnectivityModule, RCTEventEmitter)

RCT_EXTERN_METHOD(getCurrentState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// `timeoutMs` must be `nonnull`: React Native's classic iOS bridge
// (RCTModuleMethod) rejects any registered method whose signature declares
// a nullable NSNumber argument — a hard runtime error ("React requires
// that all NSNumber arguments are explicitly marked as `nonnull`"), not
// just a warning. The JS-facing API stays ergonomically optional; the
// caller (ConnectivityService.isReachable) always fills in a concrete
// default before this bridge call is made. See docs/BUGS.md.
RCT_EXTERN_METHOD(checkInternetReachability:(nonnull NSNumber *)timeoutMs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startMonitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopMonitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
