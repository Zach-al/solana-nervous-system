# SOLNET — Decentralized RPC Mesh for Solana

> Solana is decentralized. Its infrastructure should be too.

## What is SOLNET?

SOLNET replaces centralized RPC providers like Helius and QuickNode 
with a self-healing peer-to-peer mesh network. Any device installs 
our daemon in one command, joins the mesh, and earns SOL automatically 
for routing blockchain traffic.

## Live Demo
- Dashboard: https://solnet.vercel.app
- Node endpoint: https://your-railway-url.up.railway.app
- Health check: https://your-railway-url.up.railway.app/health

## Quick Start — Run a Node

curl -fsSL https://raw.githubusercontent.com/yourusername/
solana-nervous-system/main/install.sh | sh

## Architecture

Client SDK → DHT Peer Discovery → Nearest Node → Solana RPC
                                        ↓
                              Micropayment Receipt
                                        ↓
                              Hourly On-chain Settlement

## Tech Stack
- Rust + Tokio + Axum (daemon)
- libp2p + Kademlia DHT (peer mesh)  
- Anchor + Solana (smart contracts)
- Next.js + Three.js (dashboard)

Solana Nervous System (SNS)

SNS is a **decentralized peer-to-peer RPC mesh network for Solana**. Any device can install the SNS daemon, join the global mesh, transparently proxy Solana JSON-RPC requests, and earn SOL micropayments automatically — all without any central coordinator.

Think of it as replacing Helius, QuickNode, and Alchemy with a self-organizing nerve system of thousands of community-run nodes. Each node contributes bandwidth and compute, is paid per request via on-chain micropayment settlement, and is held accountable by a reputation-and-staking smart contract. The more nodes join, the more resilient, fast, and decentralized Solana's access layer becomes.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATION                            │
│                    (dApp / wallet / CLI tool)                        │
└──────────────────────┬───────────────────────────────────────────────┘
                       │  JSON-RPC over HTTP
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      SNS DAEMON (sns-daemon)                         │
│  ┌─────────────────────┐    ┌────────────────────────────────────┐   │
│  │   RPC Proxy (axum)  │    │    libp2p Mesh Node                │   │
│  │   :9000             │    │    :9001  (TCP + Noise + Yamux)    │   │
│  │                     │    │                                    │   │
│  │  POST /             │    │  Kademlia DHT                      │   │
│  │  GET  /health       │    │  Peer Discovery                    │   │
│  │  GET  /stats        │    │  Gossip / Routing                  │   │
│  └─────────────────────┘    └────────────────────────────────────┘   │
└──────────┬──────────────────────────────────────────┬────────────────┘
           │  Forward RPC                             │  P2P mesh
           ▼                                          ▼
┌──────────────────────┐                  ┌────────────────────┐
│  Solana Validator /  │                  │  Other SNS Nodes   │
│  devnet / mainnet    │                  │  (global mesh)     │
└──────────────────────┘                  └────────────────────┘
           │
           │  On-chain settlement
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    SNS PROGRAM (Anchor)                              │
│                                                                      │
│  register_node()   → Stake SOL, create NodeAccount PDA              │
│  settle_payments() → Transfer earned SOL to node operator           │
│  slash_node()      → Penalize misbehaving nodes                     │
└──────────────────────────────────────────────────────────────────────┘
```

## Quick Start

Run a node in 3 commands:

```bash
# 1. Clone and build the daemon
git clone https://github.com/you/solana-nervous-system
cd solana-nervous-system/sns-daemon && cargo build --release

# 2. Start the daemon (uses devnet by default)
SOLANA_RPC_URL=https://api.devnet.solana.com ./target/release/sns-daemon

# 3. Open the live dashboard
cd ../dashboard && npm install && npm run dev
# → Open http://localhost:3000
```

Your node is now live on the mesh! Point any Solana dApp at `http://localhost:9000` instead of a centralized RPC URL.

## How Payments Work

1. **Register**: Node operator stakes SOL via `register_node` instruction (minimum 0.1 SOL). This creates a `NodeAccount` PDA and locks stake in an escrow PDA.
2. **Serve**: Daemon proxies Solana RPC requests. For every successful request, it records +100 lamports earned locally.
3. **Settle**: Periodically (or on-demand), the daemon calls `settle_payments` on-chain with signed receipts proving work was done. SOL is released from escrow to the node owner's wallet.
4. **Reputation**: Each node has a reputation score (starts at 100). Serving requests builds trust; misbehavior triggers `slash_node`, reducing reputation by 20 per infraction. Nodes falling below 20 reputation are ejected and lose 50% of their stake.

## Hackathon Demo Instructions

```bash
# Terminal 1: Start daemon
cd sns-daemon && cargo run

# Terminal 2: Send a test RPC request through your node
curl -X POST http://localhost:9000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[]}'

# Terminal 3: Check your earnings
curl http://localhost:9000/stats

# Browser: Live globe dashboard
open http://localhost:3000
```

## Project Structure

```
solana-nervous-system/
├── sns-daemon/       Rust daemon — RPC proxy + libp2p mesh node
├── sns-program/      Anchor smart contract — staking + payments + slashing
│   ├── Makefile      → `make build-sbf` (binary), `make idl` (validate IDL)
│   └── target/idl/   → hand-authored IDL JSON (see Known Issues below)
└── dashboard/        Next.js dashboard — live globe UI with real-time stats
```

## Build Status
| Component | Status | Notes |
|-----------|--------|-------|
| `sns-daemon` | ✅ Builds clean | `cargo build` + `cargo clippy` — zero warnings |
| `sns-program` binary | ✅ Builds clean | `make build-sbf` → `target/deploy/sns_program.so` |
| `sns-program` IDL | ✅ Auto-gen succeeds | Anchor 0.30 IDL generation + TypeScript tests passing strictly |
| `dashboard` | ✅ Builds clean | `npm run build` — all TypeScript checks & Turbopack pass |

## Roadmap

### Protocol
- **Mainnet deployment** — `sns_program` to mainnet-beta with bootstrapping grants
- **ZK-verified payment receipts** — Groth16/STARK proofs replacing trusted receipt submission
- **Node reputation slashing** — On-chain misbehavior evidence, automated authority
- **Token-incentivized bootstrapping** — SNS governance token for early node operators
- **Mobile daemon** — iOS/Android daemon via Rust aarch64 cross-compilation

### Networking
- **Load balancing** — Route to least-loaded peer via DHT metadata
- **Geographic routing** — Prefer closest nodes via IP geolocation + DHT region tags
- **Payment channels** — State channels for high-frequency micropayments
- **GossipSub receipts** — P2P receipt gossip before on-chain settlement

### Cryptography & Security
- **BLS receipt aggregation** — Batch thousands of receipts into one on-chain proof
- **Client signature verification** — Prevent free-riding via signed RPC requests

### Developer Experience
- **Client SDK** — Drop-in `@solana/web3.js` `Connection` routing through SNS
- **Node operator dashboard** — Wallet connect + on-chain registration from the browser
- **`sns` CLI** — `sns start`, `sns register`, `sns withdraw`, `sns status`
