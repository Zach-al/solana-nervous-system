//
// Use this file to import your target's public headers that you would like to expose to Swift.
//

// React Native bridge — required for native module interop
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTLog.h>

// Rust FFI — C functions exported from sns-daemon/src/lib.rs
// This replaces @_silgen_name declarations in Swift files.
#include "../../sns-daemon/include/solnet_ffi.h"

