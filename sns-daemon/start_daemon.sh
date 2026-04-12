#!/bin/bash

# Configuration for sns-daemon live demo
export PORT=3000
export LOG_LEVEL=debug
export RUST_LOG=debug

echo "Starting sns-daemon on port $PORT with log level $LOG_LEVEL"
./target/release/sns-daemon
