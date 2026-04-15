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
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-BSL%201.1-blue?style=flat-square" /></a>
</p>

<p align="center">
  <a href="#-quick-documentation">Quick Documentation</a> •
  <a href="docs/USER_GUIDE.md">User Guide</a> •
  <a href="docs/SYSTEM_REQUIREMENTS.md">System Requirements</a> •
  <a href="README-MOBILE.md">Mobile Setup</a> •
  <a href="docs/ARCHITECTURE.md">Architecture</a>
</p>

---

## P2P Mesh & NAT Traversal

SOLNET uses native libp2p — no VPNs, no TURN servers,
no centralized infrastructure.

### How nodes find each other

1. New node starts and connects to bootstrap relay
2. AutoNAT probes determine NAT type
3. Kademlia DHT propagates peer routing tables
4. DCUtR hole punching upgrades relay to direct connection
5. Result: direct peer-to-peer connection even behind NAT

### Transport stack

TCP + QUIC run simultaneously on port 9001:
- QUIC (UDP): faster, better for mobile networks
- TCP: fallback for networks that block UDP
- Noise protocol: all connections encrypted
- Yamux: connection multiplexing

### Connect to the mesh

```bash
export SOLNET_BOOTSTRAP="/dns4/solnet-production.up.railway.app/tcp/9001/p2p/<RELAY_PEER_ID>"
cargo run --release
```

Watch hole punching in real time:
```bash
RUST_LOG=debug cargo run --release 2>&1 | grep -E "DCUtR|NAT|relay"
```

### NAT compatibility

| NAT Type | Direct Connection | Via Relay |
|----------|-------------------|-----------|
| Full Cone | ✅ Direct | N/A |
| Restricted Cone | ✅ via DCUtR | Fallback |
| Port Restricted | ✅ via DCUtR | Fallback |
| Symmetric | ⚠️ Hard | ✅ Relay |
| No NAT (server) | ✅ Direct | N/A |

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

## Mobile & Raspberry Pi

SOLNET runs on any device. One command install:

### macOS / Linux
```bash
curl -fsSL https://raw.githubusercontent.com/Zach-al/solana-nervous-system/main/install.sh | sh
```

### Raspberry Pi
```bash
curl -fsSL https://raw.githubusercontent.com/Zach-al/solana-nervous-system/main/scripts/install-pi.sh | sh

# Auto-start on boot
sudo cp scripts/solnet.service /etc/systemd/system/
sudo systemctl enable solnet && sudo systemctl start solnet
```

### Cross-compilation (build for other platforms)
```bash
# Build for Raspberry Pi from Mac
make build-pi

# Build for Android
make build-android
```

### Supported Platforms
| Platform | Status | Notes |
|----------|--------|-------|
| macOS (M1/M2/Intel) | ✅ Full node | Recommended for dev |
| Linux x64 | ✅ Full node | Recommended for servers |
| Raspberry Pi 4 | ✅ Full node | Recommended for home |
| Windows | ✅ Full node | Via WSL2 recommended |
| Android | ✅ Light node | Battery optimized |
| iOS | ✅ Light node | Battery optimized |

Mobile nodes (iOS/Android) run in light mode:
- No DHT peer discovery (saves battery)
- Routes through nearest desktop node
- 2-hour settlement batching (saves battery)
- Auto-throttle below 20% battery
- Earns SOL just like desktop nodes

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
| `sns-daemon` | 2.1.0 | Rust, Tokio, Axum, libp2p, AES-GCM, X25519 |
| `sns-program` | 2.1.0 | Anchor, anchor-spl, Solana |
| `solnet-sdk` | 2.1.0 | TypeScript, @solana/web3.js |
| `dashboard` | 2.1.0 | Next.js 16, Three.js, Tailwind CSS |

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
| **V1.2** | **Mobile daemon (iOS/Android/Pi), battery guard, cross-compilation** | **✅ Current** |
| V2.0 | Light Protocol ZK-compression, Groth16 receipt proofs | ✅ Complete |
| V2.1 | Wallet rewards, latency engine, security hardening | ✅ Complete |
| V2.2 | Sharded mesh routing, multi-region orchestration | 🔜 Next |

---

## License

MIT — [Bhupen Nayak](https://github.com/Zach-al)

---

<p align="center">
  <em>Solana is decentralized. Its infrastructure should be too.</em>
</p>
