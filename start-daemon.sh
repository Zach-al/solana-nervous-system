#!/bin/bash
# Kill anything on 8080 first
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:9001 | xargs kill -9 2>/dev/null || true

export PORT=8080
export RUST_LOG=sns_daemon=info,libp2p=warn
export SOLNET_BOOTSTRAP="/dns4/solnet-production.up.railway.app/tcp/443/wss/p2p/12D3KooWAH253rSpr8ryATyS45AXq7whPN1giEv6A7pufF5fmmNj"

# Preserve stable peer identity across restarts
if [ ! -f ./node_keypair.bin ]; then
  echo "[start-daemon] No keypair found, will generate on first run"
fi

cargo run --release --bin sns-daemon
