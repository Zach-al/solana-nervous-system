.PHONY: build install build-ios build-android \
        build-pi build-all release clean help

# Default desktop build
build:
	cd sns-daemon && cargo build --release
	@echo "✓ Desktop build complete"

# Install cross-compilation tool
install-cross:
	cargo install cross --git https://github.com/cross-rs/cross
	@echo "✓ cross installed"

# iOS build (requires macOS + Xcode)
build-ios:
	cd sns-daemon && \
	cross build --release --target aarch64-apple-ios
	@echo "✓ iOS build: target/aarch64-apple-ios/release/"

# Android ARM64 build
build-android:
	cd sns-daemon && \
	cross build --release --target aarch64-linux-android
	@echo "✓ Android build: target/aarch64-linux-android/release/"

# Raspberry Pi 4 build (ARM64 Linux)
build-pi:
	cd sns-daemon && \
	cross build --release --target aarch64-unknown-linux-gnu
	@echo "✓ Raspberry Pi build: target/aarch64-unknown-linux-gnu/release/"

# Windows build
build-windows:
	cd sns-daemon && \
	cross build --release --target x86_64-pc-windows-gnu
	@echo "✓ Windows build: target/x86_64-pc-windows-gnu/release/"

# Build all platforms
build-all: build build-pi build-android
	@echo "✓ All platform builds complete"
	@echo "  Desktop:      sns-daemon/target/release/"
	@echo "  Raspberry Pi: target/aarch64-unknown-linux-gnu/"
	@echo "  Android:      target/aarch64-linux-android/"

# Release build with maximum optimization
release:
	cd sns-daemon && \
	RUSTFLAGS="-C target-cpu=native" cargo build --release
	@echo "✓ Optimized release build complete"

# Clean all build artifacts
clean:
	cargo clean
	cd dashboard && rm -rf .next/ || true
	cd sdk && rm -rf dist/ || true
	@echo "✓ Clean complete"

help:
	@echo "SOLNET Build Targets:"
	@echo "  make build         - Desktop (current machine)"
	@echo "  make build-ios     - iOS (requires macOS+Xcode)"
	@echo "  make build-android - Android ARM64"
	@echo "  make build-pi      - Raspberry Pi 4"
	@echo "  make build-windows - Windows x64"
	@echo "  make build-all     - Desktop + Pi + Android"
	@echo "  make release       - Optimized desktop release"
	@echo "  make clean         - Remove build artifacts"
