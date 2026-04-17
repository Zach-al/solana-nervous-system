<p align="center">
  <strong>SOLNET</strong><br>
  <em>Decentralized Edge Infrastructure for Solana</em>
</p>

<p align="center">
  <a href="https://solnet-production.up.railway.app/health"><img src="https://img.shields.io/badge/Network-Operational-00c853?style=flat-square" alt="Network Status" /></a>
  <a href="https://www.npmjs.com/package/solnet-sdk"><img src="https://img.shields.io/npm/v/solnet-sdk?style=flat-square&color=0072f5&label=SDK" alt="npm" /></a>
  <a href="https://hashlock.com"><img src="https://img.shields.io/badge/Audit-Hashlock_Pending-f5a623?style=flat-square" alt="Audit" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License" /></a>
</p>

---

SOLNET is a high-availability Decentralized Physical Infrastructure Network (DePIN) designed to provide resilient RPC services for the Solana ecosystem. By utilizing a community-owned P2P mesh architecture—implemented with Rust, libp2p, and Anchor—SOLNET enables decentralized request routing, minimizing reliance on centralized infrastructure providers while allowing node operators to earn SOL rewards for contributing compute and bandwidth.

## Infrastructure

| Service | Technology | Endpoint |
|---|---|---|
| **Edge Daemon** | Rust / Axum / libp2p | [Railway (Production)](https://solnet-production.up.railway.app/health) |
| **Dashboard** | Next.js 15 / React Three Fiber | [Vercel (Production)](https://solnet-wheat.vercel.app) |
| **Settlement Core** | Anchor / Solana (Mainnet Beta) | `SNS_v2_Enterprise` |
| **Client SDK** | TypeScript / Zero-dependency | [`solnet-sdk` on npm](https://www.npmjs.com/package/solnet-sdk) |

## Quick Start

### Run an Edge Node

```bash
git clone https://github.com/Zach-al/solana-nervous-system
cd solana-nervous-system/sns-daemon
cargo build --release
./target/release/sns-daemon
```

The daemon binds to `0.0.0.0:9000` (HTTP) and `0.0.0.0:9001` (P2P) by default. Override with environment variables:

### Integrate the SDK

```bash
npm install solnet-sdk
```

```typescript
import { SolnetConnection } from 'solnet-sdk'

// Drop-in replacement for @solana/web3.js Connection
const connection = new SolnetConnection({
  endpoint: 'https://solnet-production.up.railway.app',
  fallback: 'https://api.mainnet-beta.solana.com',
})

const balance = await connection.getBalance(publicKey)
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `9000` | HTTP server port (Railway overrides dynamically) |
| `P2P_PORT` | `9001` | libp2p mesh listener port |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Upstream Solana RPC endpoint |
| `NODE_WALLET_PUBKEY` | — | Operator wallet for reward settlement |
| `SOLNET_NODE_KEY` | — | Ed25519 private key (base64) for stable Peer ID |
| `SOLNET_BOOTSTRAP` | — | Comma-separated multiaddr list of bootstrap peers |
| `SOLNET_SHARD` | `general` | Traffic specialization: `general`, `defi`, `nft` |
| `SOLNET_REGION` | `asia-south` | Geographic routing hint |
| `RATE_LIMIT` | `100` | Maximum requests per minute per IP |
| `MAX_CONCURRENT` | `100` | Global concurrent request limit |
| `SOLNET_WHITELIST_IP` | — | Production IP whitelist (comma-separated) |
| `SOLNET_NO_TELEMETRY` | `false` | Disable anonymous telemetry |

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design, including the PeerGuard security model, the settlement lifecycle, and the DHT discovery flow.

## Security

See [SECURITY.md](SECURITY.md) for the threat model, CVE patch status, and responsible disclosure policy.

## Documentation

| Document | Description |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, data flows, and security model |
| [SECURITY.md](SECURITY.md) | Threat model and vulnerability disclosure |
| [ROADMAP.md](ROADMAP.md) | Product roadmap and phased rollout |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [README-MOBILE.md](README-MOBILE.md) | Mobile and edge device deployment guide |
| [sdk/README.md](sdk/README.md) | Enterprise SDK documentation |

## License

MIT — © 2026 SOLNET Enterprise. All rights reserved.
