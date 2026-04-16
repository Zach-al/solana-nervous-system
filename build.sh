#!/bin/bash
set -e

echo "Starting SOLNET Enterprise Build..."
echo "Cleaning old artifacts..."
rm -rf ./bin/sns-daemon
rm -rf sns-daemon/target/release/sns-daemon

cd sns-daemon
cargo build --release

echo "Preparing deployment artifacts..."
# Versioned binary name to break caches
FINAL_BIN="SOLNET_DAEMON_V212"

# Handle both workspace and non-workspace build output paths
if [ -f target/release/sns-daemon ]; then
  cp target/release/sns-daemon "../$FINAL_BIN"
elif [ -f ../target/release/sns-daemon ]; then
  cp ../target/release/sns-daemon "../$FINAL_BIN"
else
  echo "ERROR: sns-daemon binary not found after build!"
  exit 1
fi

chmod +x "../$FINAL_BIN"
echo "Final artifact status at root:"
ls -lh "../$FINAL_BIN"

echo "Build complete."
