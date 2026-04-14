#!/bin/bash
set -e

echo "Starting SOLNET Enterprise Build..."
cd sns-daemon
cargo build --release

echo "Preparing deployment artifacts..."
mkdir -p ../bin
cp target/release/sns-daemon ../bin/sns-daemon
chmod +x ../bin/sns-daemon

echo "Build complete."
