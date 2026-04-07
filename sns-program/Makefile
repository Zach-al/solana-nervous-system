# Solana Nervous System — sns-program Makefile
# ─────────────────────────────────────────────────────────────────────────────
# Context: anchor-syn 0.30.1 calls proc_macro2::Span::source_file() which was
# removed from proc-macro2 in v1.0.80. The IDL step fails on Rust stable.
# Workaround: build the .so via cargo-build-sbf directly (skipping anchor's
# IDL step), and use the hand-authored IDL in target/idl/sns_program.json.
# ─────────────────────────────────────────────────────────────────────────────

ANCHOR    := $(HOME)/.avm/bin/anchor
PROGRAM   := programs/sns-program
SO_OUT    := target/deploy/sns_program.so
IDL_OUT   := target/idl/sns_program.json

.PHONY: all build build-sbf idl test clean deploy-localnet keys-sync

## Default target: compile the program binary
all: build

## Full anchor build (binary + attempts IDL — IDL step may warn on Rust stable)
build:
	@echo "→ Building sns-program with anchor..."
	$(ANCHOR) build || true
	@test -f $(SO_OUT) && echo "✓ Binary: $(SO_OUT)" || (echo "✗ Build failed" && exit 1)

## Build only the .so binary via cargo-build-sbf (bypasses anchor IDL step)
build-sbf:
	@echo "→ Compiling to SBF (skipping IDL)..."
	cargo build-sbf --manifest-path $(PROGRAM)/Cargo.toml
	@echo "✓ $(SO_OUT)"

## Validate the hand-authored IDL is valid JSON
idl:
	@echo "→ Validating IDL JSON..."
	@cat $(IDL_OUT) | python3 -m json.tool > /dev/null && echo "✓ IDL valid: $(IDL_OUT)"

## Run Anchor tests against localnet
test:
	@echo "→ Running tests on localnet..."
	$(ANCHOR) test --skip-build

## Sync program keys
keys-sync:
	$(ANCHOR) keys sync

## Deploy to localnet (start solana-test-validator first)
deploy-localnet:
	@echo "→ Deploying to localnet..."
	solana program deploy $(SO_OUT) --url localhost

## Clean build artifacts
clean:
	cargo clean
	rm -f *.json
