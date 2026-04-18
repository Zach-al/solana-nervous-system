#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DAEMON="$ROOT/sns-daemon"
JNI="$ROOT/mobile-app/android/app/src/main/jniLibs"

echo "▶ SOLNET Android Build — cargo-ndk"
echo "  Targets: arm64-v8a  armeabi-v7a  x86_64"
echo ""

command -v cargo >/dev/null || { echo "ERROR: cargo not found"; exit 1; }

# Install cargo-ndk if missing
if ! command -v cargo-ndk &>/dev/null; then
    echo "→ Installing cargo-ndk..."
    cargo install cargo-ndk --locked
fi

# Locate NDK
if [ -z "${ANDROID_NDK_HOME:-}" ]; then
    # Auto-detect common macOS location
    NDK_BASE="$HOME/Library/Android/sdk/ndk"
    if [ -d "$NDK_BASE" ]; then
        LATEST=$(ls "$NDK_BASE" | sort -V | tail -1)
        export ANDROID_NDK_HOME="$NDK_BASE/$LATEST"
        echo "→ NDK auto-detected: $ANDROID_NDK_HOME"
    else
        echo "ERROR: ANDROID_NDK_HOME not set."
        echo "Fix:  export ANDROID_NDK_HOME=~/Library/Android/sdk/ndk/<version>"
        exit 1
    fi
fi

# Add targets
rustup target add \
    aarch64-linux-android \
    armv7-linux-androideabi \
    x86_64-linux-android

cd "$DAEMON"
mkdir -p "$JNI"

echo "→ Building (this takes ~3 minutes first time)..."
cargo ndk \
    --target aarch64-linux-android \
    --target armv7-linux-androideabi \
    --target x86_64-linux-android \
    --platform 28 \
    --output-dir "$JNI" \
    -- build --release --features android-jni \
    2>&1 | grep -E "^(error|warning\[|Compiling sns|Finished)" || true

echo ""
echo "✓ Built:"
find "$JNI" -name "*.so" | sort | while read -r f; do
    SIZE=$(du -sh "$f" | cut -f1)
    ABI=$(basename "$(dirname "$f")")
    printf "  %-12s  %s\n" "$ABI" "$SIZE"
done
echo ""
echo "Next: npx expo run:android"
