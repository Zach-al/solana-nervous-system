#!/bin/bash
echo "==========================================="
echo "   SOLNET PRODUCTION STARTUP (V2.1.2.1)    "
echo "==========================================="
echo "[DIAG] Current Directory: $(pwd)"
echo "[DIAG] User: $(whoami)"
echo "[DIAG] OS: $(uname -a)"

# Increase file descriptor limit for Enterprise p2p mesh
ulimit -n 65535 || echo "[WARN] Could not increase ulimit"

echo "[DIAG] Environment Check:"
env | grep -E "PORT|SOLANA_RPC_URL|NODE_NAME" || echo "No public vars found"

# Logic to find the binary
WORKSPACE_BINARY="./target/release/sns-daemon"
MEMBER_BINARY="./sns-daemon/target/release/sns-daemon"
CUSTOM_BINARY="./SOLNET_DAEMON_V212"

TARGET_BIN=""

if [ -f "$WORKSPACE_BINARY" ]; then
    echo "[INFO] Found Workspace Binary at $WORKSPACE_BINARY"
    TARGET_BIN="$WORKSPACE_BINARY"
elif [ -f "$MEMBER_BINARY" ]; then
    echo "[INFO] Found Member Binary at $MEMBER_BINARY"
    TARGET_BIN="$MEMBER_BINARY"
elif [ -f "$CUSTOM_BINARY" ]; then
    echo "[WARN] Found LEGACY Binary at $CUSTOM_BINARY. Using with caution."
    TARGET_BIN="$CUSTOM_BINARY"
else
    echo "[ERROR] NO DAEMON BINARY FOUND!"
    echo "Files in current directory:"
    ls -R | grep -i daemon || echo "No files matching 'daemon' found"
    exit 1
fi

echo "[INFO] Executing $TARGET_BIN..."
chmod +x "$TARGET_BIN"
exec "$TARGET_BIN"
