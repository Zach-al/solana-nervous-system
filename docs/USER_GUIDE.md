# SOLNET V2.0 Enterprise User Guide

Welcome to SOLNET V2.1 (Enterprise) & V1.2 (Mobile), the world's first decentralized RPC infrastructure for Solana. This guide covers setup, advanced configuration, and troubleshooting.

## 1. Quick Setup

### The Universal Installer
The easiest way to get started on any platform:
```bash
curl -fsSL https://raw.githubusercontent.com/Zach-al/solana-nervous-system/main/install.sh | sh
```
For Raspberry Pi specific optimizations, use:
```bash
curl -fsSL https://raw.githubusercontent.com/Zach-al/solana-nervous-system/main/scripts/install-pi.sh | sh
```

## 2. Advanced Configuration (V2.1 Enterprise)

Configure your node using environment variables or a `.env` file in the `sns-daemon` directory.

### Performance Tuning
*   **`MAX_CONCURRENT`**: Limits parallel request processing. (Recommended: CPU Cores * 100).
*   **`LATENCY_ENGINE`**: Set to `true` (default) to enable the Helius-beating sub-10ms routing engine.
*   **`SHARD_TYPE`**: `DeFi`, `NFT`, or `General`. Specializing increases reward multipliers for that traffic type.

### Wallet & Rewards
To earn SOLNET rewards, you must configure a node wallet:
*   **`NODE_WALLET_PUBKEY`**: Your Solana public key.
*   **`EARNINGS_MODE`**: `Accumulate` (hold in contract) or `AutoClaim` (settle daily).

## 3. Operations & Monitoring

### Local Health Check
Verify your node is processing requests locally:
```bash
curl http://localhost:9000/health
```

### Dashboard Integration
Your node will automatically appear on the [Live Dashboard](https://solnet-wheat.vercel.app) once it joins the P2P mesh. You can monitor:
*   Real-time Latency (ms)
*   Requests Served
*   Total SOLNET Earned
*   Battery/Efficiency status (for Mobile nodes)

## 4. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **P2P Connection Error** | Firewall blocking Port 9001 | Open TCP 9001 in your router/cloud settings. |
| **High Latency** | Weak upstream RPC | Use a faster `SOLANA_RPC_URL` (e.g., your own node). |
| **Zero Rewards** | Wallet not set | Ensure `NODE_WALLET_PUBKEY` is valid and saved. |
| **Build Fails (Mobile)** | OOM (Out of Memory) | Ensure 2GB swap space is enabled on your device. |

## 5. Security & Guidelines

*   **Do not share your private keys:** SOLNET only requires your Public Key for rewards.
*   **Keep Up-to-Date:** Run `git pull && make build` weekly to receive security patches and performance fixes.
*   **Join the Community:** Join our Discord for live support and network updates.
