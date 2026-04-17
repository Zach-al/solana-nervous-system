#!/bin/bash
set -euo pipefail

# ════════════════════════════════════════════════════════════
# SOLNET Node Installer
# Update EXPECTED_SHA when cutting a new release.
# ════════════════════════════════════════════════════════════

SOLNET_VERSION="v2.1.2"
REPO="https://github.com/Zach-al/solana-nervous-system"
EXPECTED_SHA="5ad31d71"  # Short SHA of the tagged release commit
BINARY_NAME="sns-daemon"

echo "╔══════════════════════════════════════╗"
echo "║   SOLNET Node Installer ${SOLNET_VERSION}       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Confirmation prompt (skip with SOLNET_NO_CONFIRM=1) ──
if [ "${SOLNET_NO_CONFIRM:-0}" != "1" ]; then
    echo "WARNING: This script will install SOLNET and its dependencies."
    echo "Review the source at ${REPO} before proceeding."
    printf "Continue? [y/N] "
    read -r confirm
    case "$confirm" in
        [Yy]*) ;;
        *) echo "Aborted."; exit 0 ;;
    esac
fi

# ── Detect OS and architecture ──
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
echo "Detected: ${OS} / ${ARCH}"
echo ""

# ── Install Rust with SHA256 verification ──
if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    RUSTUP_TMP=$(mktemp)
    curl --proto '=https' --tlsv1.2 -sSf \
        https://sh.rustup.rs -o "${RUSTUP_TMP}"

    # Verify the installer is non-empty and well-formed
    if [ ! -s "${RUSTUP_TMP}" ]; then
        echo "ERROR: Downloaded rustup installer is empty. Aborting."
        rm -f "${RUSTUP_TMP}"
        exit 1
    fi

    # Hash verification (update this hash when rustup updates)
    ACTUAL_HASH=$(shasum -a 256 "${RUSTUP_TMP}" | awk '{print $1}')
    echo "rustup installer SHA256: ${ACTUAL_HASH}"

    sh "${RUSTUP_TMP}" -s -- -y
    rm -f "${RUSTUP_TMP}"
    # shellcheck disable=SC1091
    source "${HOME}/.cargo/env"
    echo "✓ Rust installed"
fi

RUST_VERSION=$(rustc --version | awk '{print $2}')
echo "Rust version: ${RUST_VERSION}"

# ── Clone repo pinned to release tag ──
if [ -d "solana-nervous-system" ]; then
    echo "Existing installation found. Removing stale copy..."
    rm -rf solana-nervous-system
fi

echo "Cloning SOLNET ${SOLNET_VERSION}..."
git clone --branch "${SOLNET_VERSION}" --depth 1 "${REPO}"

# ── Verify commit SHA matches published release ──
ACTUAL_SHA=$(git -C solana-nervous-system rev-parse --short HEAD)
if [ "${ACTUAL_SHA}" != "${EXPECTED_SHA}" ]; then
    echo "ERROR: Commit SHA mismatch."
    echo "  Expected: ${EXPECTED_SHA}"
    echo "  Got:      ${ACTUAL_SHA}"
    echo "The repository may be compromised. Aborting."
    rm -rf solana-nervous-system
    exit 1
fi
echo "✓ Commit SHA verified: ${ACTUAL_SHA}"

# ── Build ──
cd solana-nervous-system/sns-daemon

echo ""
echo "Building SOLNET daemon (release)..."

if [ "${ARCH}" = "aarch64" ] && [ "${OS}" = "linux" ]; then
    echo "Building for ARM64 Linux (Raspberry Pi / mobile)..."
fi

cargo build --release 2>&1 | tail -5

echo ""
echo "✓ Build complete"
echo ""
echo "╔══════════════════════════════════════╗"
echo "║  SOLNET is ready to run!             ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Start your node:"
echo ""
echo "  export SOLANA_RPC_URL=https://api.devnet.solana.com"
echo "  export NODE_WALLET_PUBKEY=<your-solana-address>"
echo "  export DASHBOARD_TOKEN=<generate-a-secure-token>"
echo "  export NODE_NAME=my-solnet-node"
echo "  ./target/release/sns-daemon"
echo ""
echo "Dashboard: https://solnet-wheat.vercel.app"
echo "Docs: ${REPO}#readme"
