#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DAEMON="$ROOT/sns-daemon"
OUT="$ROOT/mobile-app/ios/Frameworks"

echo "▶ SOLNET iOS Build — Rust 1.85.0"
echo "  Targets: device + Apple Silicon sim + Intel sim → XCFramework"
echo ""

# Prerequisites
command -v cargo >/dev/null || { echo "ERROR: cargo not found"; exit 1; }
command -v xcodebuild >/dev/null || { echo "ERROR: xcodebuild not found (macOS only)"; exit 1; }

# Add targets (idempotent)
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios

cd "$DAEMON"

# Device
echo "→ aarch64-apple-ios (physical device)..."
cargo build --release --target aarch64-apple-ios \
    --features ios-static 2>&1 | grep -E "^(error|warning\[|Compiling sns|Finished)" || true

# Apple Silicon simulator
echo "→ aarch64-apple-ios-sim (Apple Silicon simulator)..."
cargo build --release --target aarch64-apple-ios-sim \
    --features ios-static 2>&1 | grep -E "^(error|warning\[|Compiling sns|Finished)" || true

# Intel simulator
echo "→ x86_64-apple-ios (Intel simulator)..."
cargo build --release --target x86_64-apple-ios \
    --features ios-static 2>&1 | grep -E "^(error|warning\[|Compiling sns|Finished)" || true

# Universal sim slice
echo "→ lipo: universal simulator..."
mkdir -p "$ROOT/target/sim-universal/release"
lipo -create \
    "$ROOT/target/aarch64-apple-ios-sim/release/libsns_daemon.a" \
    "$ROOT/target/x86_64-apple-ios/release/libsns_daemon.a" \
    -output "$ROOT/target/sim-universal/release/libsns_daemon.a"

# XCFramework
echo "→ xcodebuild: XCFramework..."
rm -rf "$OUT/SolnetDaemon.xcframework"
mkdir -p "$OUT"
xcodebuild -create-xcframework \
    -library "$ROOT/target/aarch64-apple-ios/release/libsns_daemon.a" \
    -headers "$DAEMON/include" \
    -library "$ROOT/target/sim-universal/release/libsns_daemon.a" \
    -headers "$DAEMON/include" \
    -output "$OUT/SolnetDaemon.xcframework"

# Copy header
mkdir -p "$ROOT/mobile-app/ios/SOLNET"
cp "$DAEMON/include/solnet_ffi.h" "$ROOT/mobile-app/ios/SOLNET/solnet_ffi.h"

# Sizes
echo ""
echo "✓ Built:"
find "$OUT" -name "*.a" -exec sh -c 'echo "  $(du -sh "$1" | cut -f1)  $1"' _ {} \;
echo ""
echo "✓ Header: mobile-app/ios/SOLNET/solnet_ffi.h"
echo ""
echo "Next: open Xcode → add ios/Frameworks/SolnetDaemon.xcframework"
echo "      then: npx expo run:ios"
