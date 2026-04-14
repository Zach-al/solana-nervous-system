#!/bin/bash
set -e

REPO="https://github.com/Zach-al/solana-nervous-system"
BINARY_NAME="sns-daemon"
VERSION="2.1.0"

echo "╔══════════════════════════════════════╗"
echo "║     SOLNET Node Installer v${VERSION}     ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

echo "Detected: $OS / $ARCH"
echo ""

# Check Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf \
        https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    echo "✓ Rust installed"
fi

# Check Rust version
RUST_VERSION=$(rustc --version | awk '{print $2}')
echo "Rust version: $RUST_VERSION"

# Clone or update repo
if [ -d "solana-nervous-system" ]; then
    echo "Updating existing installation..."
    cd solana-nervous-system
    git pull origin main
else
    echo "Cloning SOLNET..."
    git clone "$REPO"
    cd solana-nervous-system
fi

# Build for current platform
echo ""
echo "Building SOLNET daemon..."
cd sns-daemon

# Detect if we need special build flags
if [ "$ARCH" = "aarch64" ] && [ "$OS" = "linux" ]; then
    echo "Building for ARM64 Linux (Raspberry Pi)..."
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
echo "  export NODE_NAME=my-solnet-node"
echo "  cargo run --release"
echo ""
echo "Your node will join the SOLNET mesh"
echo "and start earning SOL immediately."
echo ""
echo "Dashboard: https://solnet-wheat.vercel.app"
echo "Docs: $REPO#readme"
