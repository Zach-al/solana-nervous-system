#!/bin/bash
set -e

# Enterprise Native Build Script for SOLNET
# Compiles Rust 'solnet_native' for Android and iOS targets.

echo "🚀 Starting Enterprise Native Build..."

# 1. Environment Check
if [ -z "$ANDROID_NDK_HOME" ]; then
    # Try to find NDK automatically in common paths
    NDK_SEARCH_PATH="$HOME/Library/Android/sdk/ndk"
    LATEST_NDK=$(ls -1 "$NDK_SEARCH_PATH" 2>/dev/null | sort -V | tail -n 1)
    
    if [ -n "$LATEST_NDK" ]; then
        export ANDROID_NDK_HOME="$NDK_SEARCH_PATH/$LATEST_NDK"
        echo "✅ Found NDK at: $ANDROID_NDK_HOME"
    else
        echo "❌ ERROR: ANDROID_NDK_HOME not set and no NDK found in $NDK_SEARCH_PATH"
        exit 1
    fi
fi

# 2. Rust Toolchain Configuration
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android aarch64-apple-ios x86_64-apple-ios || true

# 3. Build for Android (using cargo-ndk)
echo "🤖 Building for Android ABIs..."
cd ../../sns-daemon

# Remove legacy manual config if exists (cargo-ndk doesn't need it)
rm -f .cargo/config.toml

# Build for major ABIs (API 24+ required for getifaddrs)
cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 -o ../mobile-app/android/app/src/main/jniLibs --platform 24 build --lib --release --features android-jni

# 4. Build for iOS
echo "🍎 Building for iOS..."
cargo build --release --target aarch64-apple-ios

echo "📦 Copying iOS libraries..."
mkdir -p ../mobile-app/ios/Frameworks
# Artifacts are in the workspace root 'target' folder
cp ../target/aarch64-apple-ios/release/libsolnet_native.a \
   ../mobile-app/ios/Frameworks/

echo "✅ Enterprise Native Bridge built successfully"
