#!/bin/bash
echo "==========================================="
echo "   SOLNET DIAGNOSTIC STARTUP (V2.1.2)      "
echo "==========================================="
echo "Current Directory: $(pwd)"
echo "Files in Root:"
ls -F

echo "Environment Check (PORT):"
env | grep PORT

if [ -f "./SOLNET_DAEMON_V212" ]; then
    echo "Binary Found. Launching..."
    chmod +x ./SOLNET_DAEMON_V212
    ./SOLNET_DAEMON_V212
else
    echo "ERROR: SOLNET_DAEMON_V212 NOT FOUND!"
    echo "Doing deep search..."
    find . -name "SOLNET_DAEMON_V212"
    exit 1
fi
