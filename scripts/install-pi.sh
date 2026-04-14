#!/bin/bash
set -e

echo "╔══════════════════════════════════════╗"
echo "║   SOLNET Raspberry Pi Installer      ║"
echo "╚══════════════════════════════════════╝"

# Update system
sudo apt-get update -qq
sudo apt-get install -y -qq \
    build-essential \
    curl \
    pkg-config \
    libssl-dev \
    git

# Install Rust if not present
if ! command -v cargo &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf \
        https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Clone and build
git clone \
    https://github.com/Zach-al/solana-nervous-system \
    || (cd solana-nervous-system && git pull)

cd solana-nervous-system/sns-daemon
cargo build --release

echo ""
echo "✓ SOLNET installed on Raspberry Pi"
echo ""
echo "To run as a system service:"
echo "  sudo cp ../scripts/solnet.service /etc/systemd/system/"
echo "  sudo systemctl enable solnet"
echo "  sudo systemctl start solnet"
