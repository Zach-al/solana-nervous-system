#!/bin/bash
echo "═══════════════════════════════════════"
echo "  SOLNET vs Helius Latency Benchmark"
echo "═══════════════════════════════════════"

SOLNET_URL="https://solnet-production.up.railway.app"
HELIUS_URL="https://api.devnet.solana.com"
PAYLOAD='{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[]}'
RUNS=10

echo ""
echo "Testing SOLNET ($RUNS runs)..."
SOLNET_TOTAL=0
for i in $(seq 1 $RUNS); do
    TIME=$(curl -o /dev/null -s -w "%{time_total}" \
        -X POST $SOLNET_URL \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD")
    MS=$(echo "$TIME * 1000" | bc)
    echo "  Run $i: ${MS}ms"
    SOLNET_TOTAL=$(echo "$SOLNET_TOTAL + $TIME" | bc)
done
SOLNET_AVG=$(echo "scale=0; $SOLNET_TOTAL / $RUNS * 1000" | bc)
echo "  SOLNET Average: ${SOLNET_AVG}ms"

echo ""
echo "Testing Standard RPC ($RUNS runs)..."
HELIUS_TOTAL=0
for i in $(seq 1 $RUNS); do
    TIME=$(curl -o /dev/null -s -w "%{time_total}" \
        -X POST $HELIUS_URL \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD")
    MS=$(echo "$TIME * 1000" | bc)
    echo "  Run $i: ${MS}ms"
    HELIUS_TOTAL=$(echo "$HELIUS_TOTAL + $TIME" | bc)
done
HELIUS_AVG=$(echo "scale=0; $HELIUS_TOTAL / $RUNS * 1000" | bc)
echo "  Standard RPC Average: ${HELIUS_AVG}ms"

echo ""
echo "═══════════════════════════════════════"
echo "  SOLNET: ${SOLNET_AVG}ms avg"
echo "  Standard RPC: ${HELIUS_AVG}ms avg"
echo "═══════════════════════════════════════"
