#!/bin/bash
set -e

echo "Starting SOLNET Enterprise Build (ROOT-WORKSPACE MODEL)..."
echo "Cleaning old artifacts..."
rm -f ./SOLNET_DAEMON_V212
rm -rf ./target/release/sns-daemon

echo "Building SOLNET Daemon via Manifest..."
cargo build --release --manifest-path sns-daemon/Cargo.toml

echo "Preparing deployment artifacts..."
FINAL_BIN="SOLNET_DAEMON_V212"

# In a workspace, the binary is in root target/release/
if [ -f "target/release/sns-daemon" ]; then
  cp target/release/sns-daemon "./$FINAL_BIN"
else
  echo "ERROR: sns-daemon binary not found in root target/release!"
  echo "Searching for binary..."
  find . -name "sns-daemon" -type f
  exit 1
fi

chmod +x "./$FINAL_BIN"
echo "Final artifact status at root:"
ls -lh "./$FINAL_BIN"

echo "Build complete."
