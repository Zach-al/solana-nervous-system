//
//  SolnetDaemon.m
//  SOLNET
//
//  Objective-C bridge file — exposes SolnetDaemon Swift class to React Native.
//  Swift implementation lives in SolnetDaemon.swift.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// RCT_EXTERN_MODULE macro registers the Swift class as a React Native module.
RCT_EXTERN_MODULE(SolnetDaemon, RCTEventEmitter)

// ── Exposed React Native methods ──────────────────────────────────────────────

RCT_EXTERN_METHOD(
  setThrottleState:(NSString *)state
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  startDaemon:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  stopDaemon:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  getDaemonStats:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  startRelay:(NSString *)configJson
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  stopRelay:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)
