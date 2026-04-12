#!/bin/sh
set -e

echo "Downloading SOLNET daemon..."
# In a real scenario, this would download the binary from GitHub releases
# curl -L -o /usr/local/bin/sns-daemon https://github.com/yourusername/solana-nervous-system/releases/latest/download/sns-daemon

echo "Building from source instead for the hackathon demo..."
if ! command -v cargo >/dev/null 2>&1; then
    echo "Rust is required but not installed. Please install Rust via rustup."
    exit 1
fi

git clone https://github.com/yourusername/solana-nervous-system.git
cd solana-nervous-system/sns-daemon
cargo build --release
echo "SOLNET SNS Daemon installed successfully!"
echo "Run it with: SOLANA_RPC_URL=https://api.devnet.solana.com ./target/release/sns-daemon"
