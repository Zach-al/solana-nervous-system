#!/bin/bash
echo "==========================================="
echo "   SOLNET PRODUCTION STARTUP (V2.1.2.1)    "
echo "==========================================="
echo "[DIAG] Current Directory: $(pwd)"
echo "[DIAG] User: $(whoami)"
echo "[DIAG] OS: $(uname -a)"

# Increase file descriptor limit for Enterprise p2p mesh
ulimit -n 65535 || echo "[WARN] Could not increase ulimit"

# Ensure environment is clean
echo "[DIAG] Environment Check:"
env | grep -E "PORT|SOLANA_RPC_URL|NODE_NAME" || echo "No public vars found"

# Logic to find the binary (Prefer workspace build)
WORKSPACE_BINARY="./target/release/sns-daemon"
MEMBER_BINARY="./sns-daemon/target/release/sns-daemon"

TARGET_BIN=""

if [ -f "$WORKSPACE_BINARY" ]; then
    echo "[INFO] Found Workspace Binary at $WORKSPACE_BINARY"
    TARGET_BIN="$WORKSPACE_BINARY"
elif [ -f "$MEMBER_BINARY" ]; then
    echo "[INFO] Found Member Binary at $MEMBER_BINARY"
    TARGET_BIN="$MEMBER_BINARY"
else
    echo "[ERROR] NO DAEMON BINARY FOUND!"
    exit 1
fi

echo "[DIAG] Listing Active Listeners before exec:"
ss -tulpn || netstat -tulpn || echo "network audit unavailable"

echo "[INFO] Executing $TARGET_BIN..."
chmod +x "$TARGET_BIN"
exec "$TARGET_BIN"
