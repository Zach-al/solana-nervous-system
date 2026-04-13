# SOLNET — Decentralized RPC Mesh for Solana [V1.0.0]

> Solana is decentralized. Its infrastructure should be too.

SOLNET replaces centralized RPC providers like Helius and QuickNode with a self-healing, privacy-first peer-to-peer mesh network. Any device can install our daemon in one command, join the mesh, and earn SOL + $SOLNET tokens automatically for routing blockchain traffic.

## 🚀 V1.0 Mainnet Release
The V1.0 release introduces the full protocol suite for production readiness:
- **NPM SDK**: `@solnet/client` drop-in replacement for `@solana/web3.js`.
- **$SOLNET Token**: Native utility token for node incentives and priority staking.
- **Onion Routing**: Military-grade request privacy (AES-GCM/X25519).
- **ZK-Compressed Settlement**: 1000x cost reduction via Merkle tree aggregation.

## Live Demo
- **Landing Page**: http://localhost:3000/landing
- **Dashboard**: http://localhost:3000/
- **SDK**: `npm install @solnet/client`

## Quick Start — For Developers

Switch from a centralized RPC to the decentralized mesh in one line:

```typescript
import { SolnetConnection } from '@solnet/client'

// Replace standard Connection
const connection = new SolnetConnection({
  privacy: true // Enable entry-node privacy (Onion Routing)
})

// Everything else remains the same
const balance = await connection.getBalance(pubkey)
```

## Quick Start — For Node Operators

Run a node and start earning:

```bash
# 1. Install the SOLNET Daemon
curl -fsSL https://raw.githubusercontent.com/Zach-al/solana-nervous-system/main/install.sh | sh

# 2. Register your node (requires 0.1 SOL and 1000 $SOLNET for priority)
./target/release/sns-daemon --register
```

## Protocol Architecture

```
Client SDK (@solnet/client)
      │
      ▼ (Onion Routed)
┌───────────────────────┐
│     SNS DAEMON        │ ──┐   Verification: Merkle Proofs
│   (Entry Node)        │   │   Privacy: AES-256-GCM
└───────────────────────┘   │   Transport: libp2p Kademlia
      │                     │
      ▼ (Relay Hop)         │
┌───────────────────────┐   │
│     SNS DAEMON        │ ──┤
│    (Exit Node)        │   │
└───────────────────────┘   │
      │                     │
      ▼                     │
┌───────────────────────┐   │   Settlement:
│   SOLANA RPC NODE     │ ──┘   10 $SOLNET / request
└───────────────────────┘       ZK-Compressed Batches
```

## Tech Stack
- **Daemon**: Rust + Tokio + Axum + libp2p
- **Cryptography**: X25519, AES-256-GCM, SHA2-256
- **Smart Contract**: Anchor + Solana + anchor-spl
- **Developer SDK**: TypeScript + @solana/web3.js
- **Dashboard**: Next.js + Three.js + Tailwind CSS

## Build Status
| Component | Status | Notes |
|-----------|--------|-------|
| `sns-daemon` | ✅ V1.0.0 | Onion routing + P2P mesh stable |
| `sns-program` | ✅ V1.0.0 | SPL Token rewards active |
| `@solnet/client` | ✅ V1.0.0 | Drop-in ready replacement |
| `dashboard` | ✅ V1.0.0 | New premium /landing page |

## Roadmap

### Protocols (V1.1+)
- **Dynamic Decay**: Token reward halving every 100M requests.
- **Multihop Networking**: Full browser-to-exit onion paths.
- **Mobile SDK**: Native React Native / Flutter integration.

---
Built with 💜 for the Solana Hackathon 2026.
Decentralization is not a feature, it's a requirement.
