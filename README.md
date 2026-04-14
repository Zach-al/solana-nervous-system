<p align="center">
  <strong>S O L N E T</strong>
</p>

<p align="center">
  <em>Decentralized RPC Infrastructure for the Solana Mainnet</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/solnet-sdk"><img src="https://img.shields.io/npm/v/solnet-sdk?color=9945ff&label=solnet-sdk&style=flat-square" /></a>
  <a href="https://github.com/Zach-al/solana-nervous-system/actions"><img src="https://img.shields.io/badge/SLSA_Provenance-verified-brightgreen?style=flat-square" /></a>
  <a href="https://solnet-wheat.vercel.app"><img src="https://img.shields.io/badge/Dashboard-Live-00ff88?style=flat-square" /></a>
  <a href="https://solnet-production.up.railway.app/health"><img src="https://img.shields.io/badge/Node-Online-00ff88?style=flat-square" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-white?style=flat-square" /></a>
</p>

---

## The Problem

**Solana's infrastructure has a centralization crisis.**

Every major dApp on Solana routes traffic through 2–3 centralized RPC providers. When one goes down, hundreds of protocols go dark simultaneously. This architecture creates:

- **Single points of failure** — One provider outage cascades across the ecosystem
- **Censorship vectors** — A single company can block transactions from entire regions
- **Rent extraction** — $500+/month for premium endpoints with no competition on price
- **Privacy violations** — Providers see every wallet address, every transaction, every query

Solana itself is decentralized. **Its access layer is not.** SOLNET fixes this.

---

## The Solution

SOLNET is a **self-healing peer-to-peer RPC mesh** that replaces centralized providers with a global network of community-operated nodes. Any device can join the mesh, route Solana traffic, and earn rewards automatically.

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR dApp                                                  │
│  import { SolnetConnection } from 'solnet-sdk'              │
└──────────────────────────┬──────────────────────────────────┘
                           │  Onion-routed request
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  SOLNET MESH                                                │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Entry    │───▶│ Relay    │───▶│ Exit     │              │
│  │ Node     │    │ Node     │    │ Node     │              │
│  │ Mumbai   │    │ Frankfurt│    │ Tokyo    │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│       │                              │                      │
│       │  AES-256-GCM / X25519        │  Merkle proof        │
│       │  per-hop encryption          │  verification        │
└───────┼──────────────────────────────┼──────────────────────┘
        │                              │
        ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│  SOLANA VALIDATORS                                          │
│  Mainnet / Devnet                                           │
└─────────────────────────────────────────────────────────────┘
        │
        ▼  On-chain settlement
┌─────────────────────────────────────────────────────────────┐
│  SNS PROGRAM (Anchor)                                       │
│  • 10 $SOLNET minted per verified request                   │
│  • ZK-compressed batch settlement (1000x cheaper)           │
│  • Reputation slashing for misbehavior                      │
└─────────────────────────────────────────────────────────────┘
```

---

## One-Line Integration

Replace your Solana RPC connection with SOLNET. Zero code changes required.

```typescript
// Before — centralized, single point of failure
import { Connection } from '@solana/web3.js'
const connection = new Connection('https://api.mainnet-beta.solana.com')

// After — decentralized mesh, automatic failover, privacy routing
import { SolnetConnection } from 'solnet-sdk'
const connection = new SolnetConnection({
  privacy: true,        // Onion routing — hides your IP from nodes
  fallback: 'https://api.mainnet-beta.solana.com'  // Silent failover
})

// Everything works identically. Zero migration cost.
const balance = await connection.getBalance(publicKey)
const slot = await connection.getSlot()
const tx = await connection.sendTransaction(transaction)
```

```bash
npm install solnet-sdk
```

---

## Economic Flywheel

SOLNET creates a self-sustaining economy where node operators earn by serving infrastructure:

| Metric | Value |
|---|---|
| **Reward per request** | 10 $SOLNET tokens (minted via PDA) |
| **Settlement cost** | ~0.000005 SOL per batch (ZK-compressed) |
| **Minimum stake** | 0.1 SOL to register a node |
| **Priority staking** | Lock $SOLNET for increased routing priority |
| **Slashing** | -20 reputation per infraction; ejection below 20 |

**How it works:**
1. **Register** — Stake SOL on-chain via `register_node`. A `NodeAccount` PDA is created.
2. **Serve** — Your daemon proxies RPC requests. Each verified response earns rewards.
3. **Settle** — Receipts are batched into Merkle trees and settled on-chain every hour.
4. **Compound** — Stake earned $SOLNET for priority routing, earning more requests.

---

## Run a Node

```bash
git clone https://github.com/Zach-al/solana-nervous-system
cd solana-nervous-system/sns-daemon
cargo build --release
SOLANA_RPC_URL=https://api.devnet.solana.com ./target/release/sns-daemon
```

Your node joins the global mesh immediately. Earnings begin on the first proxied request.

---

## Security

| Layer | Implementation |
|---|---|
| **Transport** | AES-256-GCM + X25519 ECDH per-hop onion encryption |
| **Verification** | Merkle proof on every RPC response — clients verify without trust |
| **Settlement** | ZK-compressed batch receipts with on-chain replay protection |
| **Reputation** | Stake-weighted scoring with automated slashing for misbehavior |
| **Supply Chain** | NPM package published with **SLSA provenance** via GitHub Actions |
| **API Security** | HMAC-SHA256 request signing, rate limiting, circuit breaker |

---

## Architecture

```
solana-nervous-system/
├── sns-daemon/          Rust — RPC proxy + libp2p mesh + onion router
├── sns-program/         Anchor — staking, settlement, $SOLNET rewards
├── sdk/                 TypeScript — solnet-sdk (npm)
└── dashboard/           Next.js — operator dashboard + landing page
```

| Component | Version | Stack |
|---|---|---|
| `sns-daemon` | 1.0.0 | Rust, Tokio, Axum, libp2p, AES-GCM, X25519 |
| `sns-program` | 1.0.0 | Anchor, anchor-spl, Solana |
| `solnet-sdk` | 1.0.0 | TypeScript, @solana/web3.js |
| `dashboard` | 1.0.0 | Next.js 16, Three.js, Tailwind CSS |

---

## Live Infrastructure

| Service | URL | Status |
|---|---|---|
| **Dashboard** | [solnet-wheat.vercel.app](https://solnet-wheat.vercel.app) | ● Live |
| **Landing Page** | [solnet-wheat.vercel.app/landing](https://solnet-wheat.vercel.app/landing) | ● Live |
| **RPC Endpoint** | [solnet-production.up.railway.app](https://solnet-production.up.railway.app/health) | ● Live |
| **NPM Package** | [npmjs.com/package/solnet-sdk](https://www.npmjs.com/package/solnet-sdk) | ● Published |

```bash
# Verify the node is live
curl https://solnet-production.up.railway.app/health

# Send an RPC request through the mesh
curl -X POST https://solnet-production.up.railway.app \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[]}'
```

---

## Roadmap

| Phase | Description | Status |
|---|---|---|
| V0.1 | P2P daemon, basic RPC proxy, Anchor settlement | ✅ Complete |
| V0.2 | Cryptographic Merkle proof response verification | ✅ Complete |
| V0.3 | ZK-compressed batch settlement (1000x cost reduction) | ✅ Complete |
| V0.4 | Onion routing privacy layer (AES-GCM + X25519) | ✅ Complete |
| V1.0 | $SOLNET token, NPM SDK, production deployment | ✅ Complete |
| V2.0 | Light Protocol ZK-compression, Groth16 receipt proofs | ✅ Complete |
| **V2.1** | **Wallet rewards, latency engine, benchmarks** | **✅ Current** |
| V2.2 | Mobile daemon (iOS/Android via Rust cross-compilation) | 📋 Planned |

---

## License

MIT — [Bhupen Nayak](https://github.com/Zach-al)

---

<p align="center">
  <em>Solana is decentralized. Its infrastructure should be too.</em>
</p>
