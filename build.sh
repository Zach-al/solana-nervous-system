#!/bin/bash
set -e

echo "Starting SOLNET Enterprise Build..."
cd sns-daemon
cargo build --release

echo "Preparing deployment artifacts..."
mkdir -p ../bin

# Handle both workspace and non-workspace build output paths
if [ -f target/release/sns-daemon ]; then
  cp target/release/sns-daemon ../bin/sns-daemon
elif [ -f ../target/release/sns-daemon ]; then
  cp ../target/release/sns-daemon ../bin/sns-daemon
else
  echo "ERROR: sns-daemon binary not found!"
  echo "Searching for binary..."
  find .. -name "sns-daemon" -type f 2>/dev/null || true
  exit 1
fi

chmod +x ../bin/sns-daemon

echo "Build complete."
