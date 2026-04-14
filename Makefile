# SOLNET V2.0 Enterprise Build System

.PHONY: all build build-release test clean doc deploy-vercel deploy-railway mobile-android mobile-ios

all: build

build:
	cd sns-daemon && cargo build
	cd sns-program && anchor build
	cd sdk && npm run build

build-release:
	cd sns-daemon && cargo build --release
	cd sns-program && anchor build --provider.cluster mainnet
	cd sdk && npm run build

test:
	cd sns-daemon && cargo test
	cd sns-program && anchor test
	cd sdk && npm test

clean:
	cd sns-daemon && cargo clean
	cd sns-program && anchor clean
	rm -rf sdk/dist

doc:
	cd sns-daemon && cargo doc --no-deps
	cd sdk && npm run doc

deploy-vercel:
	cd dashboard && vercel --prod

deploy-railway:
	railway up

# Mobile Cross-Compilation (V1.2 Prep)
mobile-android:
	cd sns-daemon && cargo build --target aarch64-linux-android --release

mobile-ios:
	cd sns-daemon && cargo build --target aarch64-apple-ios --release

# Security Audit
audit:
	cd sns-daemon && cargo audit
	cd sns-program && cargo audit
	cd sdk && npm audit
