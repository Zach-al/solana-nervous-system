#!/bin/bash
set -e

echo "Starting SOLNET Enterprise Build..."
echo "Cleaning old artifacts..."
rm -rf ./bin/sns-daemon
rm -rf sns-daemon/target/release/sns-daemon

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
  echo "ERROR: sns-daemon binary not found after build!"
  exit 1
fi

chmod +x ../bin/sns-daemon
echo "Final artifact status:"
ls -lh ../bin/sns-daemon

echo "Build complete."
