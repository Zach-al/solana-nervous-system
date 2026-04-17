# Solana Nervous System — Architecture

## System Overview

SNS creates a self-organizing mesh of RPC proxy nodes, removing the need for centralized Solana RPC providers. The system has three layers:

1. **Edge Layer** — SNS daemons run on community hardware worldwide
2. **Mesh Layer** — libp2p Kademlia DHT connects all nodes into a routable P2P network  
3. **Settlement Layer** — Anchor smart contract on Solana handles staking, payment, and reputation

---

## Component Descriptions

### sns-daemon (Rust)

The daemon is the core node software. It runs two concurrent async tasks:

**RPC Proxy** (`axum`, port 9000)
- Receives standard Solana JSON-RPC requests from dApps/wallets
- Validates the request has a `method` field (rejects malformed requests)
- Forwards to configurable upstream Solana endpoint (default: devnet)
- Returns response to caller; increments in-memory counters (+100 lamports per request)
- Exposes `/health` and `/stats` HTTP endpoints for monitoring

**P2P Mesh Node** (`libp2p`, port 9001)
- Transport: TCP with Noise encryption (ChaCha20Poly1305) and Yamux stream multiplexing
- Discovery: Kademlia DHT — nodes maintain routing tables of peers
- Events: Logs peer connections/disconnections and routing table updates
- Future work: gossip payment receipts, load-balance requests across peers

### sns-program (Anchor/Solana)

The on-chain program tracks node registration, escrow, and payments:

**Accounts**
- `NodeAccount` — PDA seeded `["node", owner_pubkey]`, stores endpoint, staked amount, reputation (0–100), request counter
- `EscrowAccount` — PDA seeded `["escrow", owner_pubkey]`, holds staked + earned SOL pending settlement

**Instructions**
| Instruction | Description |
|---|---|
| `register_node` | Creates `NodeAccount`, transfers stake to escrow |
| `settle_payments` | Validates receipts, moves earned SOL from escrow → owner |
| `slash_node` | Authority-only; reduces reputation; ejects if below threshold |

### dashboard (Next.js)

Interactive monitoring interface showing the global SNS mesh in real time:

- **Globe** (React Three Fiber) — 3D sphere with glowing node dots at real world city coordinates; animated arc lines between nodes for visual traffic
- **Stats Panel** — polls `/stats` every 3s; shows requests, earnings, uptime, peer count
- **Activity Feed** — sliding live feed of recent RPC method calls

---

## DHT Peer Discovery Flow

```
New Node Starts
     │
     ▼
Generate Ed25519 KeyPair → PeerId
     │
     ▼
Listen on /ip4/0.0.0.0/tcp/9001
     │
     ▼
[If bootstrap peers configured]
     │──→ Dial bootstrap peer(s)
     │         │
     │         ▼
     │    Kademlia Bootstrap Query
     │    (FIND_NODE for own PeerId)
     │         │
     │         ▼
     │    Discover N closest peers
     │    Fill local routing table
     │
     ▼
Accept incoming connections from other nodes
     │
     ▼
Respond to DHT queries
(help other nodes discover peers)
```

---

## Payment Channel Lifecycle

```
1. REGISTRATION
   NodeOperator → register_node(endpoint, stake=0.5 SOL)
   Program creates NodeAccount PDA + EscrowAccount PDA
   Stake locked in EscrowAccount

2. OPERATION
   Client → POST http://node:9000/ (JSON-RPC)
   Daemon forwards → Solana RPC endpoint
   Daemon records: requests_served++, earnings += 100 lamports
   (off-chain, in memory / local database)

3. SETTLEMENT
   Daemon (or cron job) → settle_payments(receipts=[...])
   Program validates receipts (signature, nonce)
   Program transfers earned SOL: Escrow → NodeOwner wallet
   NodeAccount.requests_served updated on-chain

4. SLASHING (if misbehavior detected)
   Authority → slash_node(node_pubkey, reason)
   NodeAccount.reputation -= 20
   If reputation < 20:
     50% stake → NodeOwner (returned)
     50% stake → burned (or protocol treasury)
     NodeAccount closed
```

---

## Security Model

| Threat | Mitigation |
|---|---|
| Sybil attacks (fake nodes) | Minimum SOL stake required to register |
| Fake payment receipts | Receipts include nonce + client signature (future: BLS aggregation) |
| Malicious proxying (MITM) | Clients verify Solana RPC responses are valid; program audits on-chain |
| Node going offline | Reputation decay for offline periods (future work) |
| DDoS on proxy port | Rate limiting middleware (future: per-IP, axum Tower layer) |
| Eclipse attacks (P2P) | Kademlia peer diversity; multiple bootstrap nodes |

---

## Tooling: Known Issues & Workarounds

### IDL Generation — `anchor-syn 0.30.1` + Rust Stable

**Root cause:** `anchor-syn 0.30.1` calls `proc_macro2::Span::source_file()` which was
removed from `proc-macro2` in v1.0.80. The call is gated behind
`#[cfg(procmacro2_semver_exempt)]` but the compiler still type-checks the block, causing
the IDL build step to fail.

**This is a tooling issue only — the SBF program binary (`sns_program.so`) compiles
cleanly. Core program logic and instruction handlers are fully implemented and functional.**

**Workaround applied:**

| Step | Command | Notes |
|------|---------|-------|
| Build binary | `make build-sbf` | Uses `cargo build-sbf` directly — clean, no IDL step |
| IDL | `make idl` | Validates hand-authored `target/idl/sns_program.json` |
| Full build | `make build` | Runs `anchor build`; binary succeeds, IDL step warned |

The hand-authored IDL (`target/idl/sns_program.json`) is kept in sync with `lib.rs` and covers all instructions, accounts, types, events, and error codes.

**Upstream fix:** Will resolve when Anchor upgrades to `anchor-syn` ≥ 0.31 (which removes the `source_file()` call), or when `proc-macro2` re-exposes `source_file()` as a stable API. Tracking: [coral-xyz/anchor#3392](https://github.com/coral-xyz/anchor/issues/3392).

---

## Future Work

### Protocol

- **Mainnet deployment** — Deploy `sns_program` to mainnet-beta; seed initial node operator community via bootstrapping grants
- **ZK-verified payment receipts** — Replace trusted receipt submission with ZK proofs (Groth16 or STARK) verifying the node served valid RPC responses without revealing client data
- **Node reputation slashing** — On-chain evidence submission for misbehaving nodes (incorrect responses, downtime attestations); slash via automated authority
- **Token-incentivized bootstrapping phase** — Emit an SNS governance token during the initial network growth phase to reward early node operators and seed the node network
- **Mobile daemon support** — Lightweight daemon binary for iOS/Android (via Rust cross-compilation to aarch64); background service earns SOL while device is idle on Wi-Fi

### Networking & Routing

- **Load balancing** — Route requests to least-loaded peer via DHT metadata attachments
- **Geographic routing** — Prefer geographically closest nodes (using IP geolocation + DHT region tags)
- **Payment channels** — State channels for high-frequency micropayments, settling on-chain periodically
- **P2P gossip for receipts** — Nodes gossip signed payment receipts via libp2p GossipSub before settling on-chain

### Cryptography & Security

- **BLS receipt aggregation** — Batch thousands of payment receipts into one compact on-chain proof
- **Noise-encrypted gossip** — All P2P messages remain encrypted end-to-end (already in place via Noise transport)
- **Client signature verification** — Daemon verifies client-signed RPC requests before proxying (prevents free-riding)

### Developer Experience

- **Client SDK** — Drop-in replacement for `@solana/web3.js` `Connection` that auto-routes through SNS mesh
- **Node operator dashboard** — Extend the Next.js dashboard with wallet connect + on-chain registration flow
- **CLI tool** — `sns` CLI for node management: `sns start`, `sns register`, `sns withdraw`, `sns status`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SOLANA_RPC_URL` | Yes | Upstream Solana RPC endpoint (e.g., `https://api.devnet.solana.com`) |
| `NODE_WALLET_PUBKEY` | Yes | Solana wallet public key for earnings (never logged in full) |
| `NODE_NAME` | No | Human-readable node identifier (default: auto-generated) |
| `DASHBOARD_TOKEN` | Yes (prod) | Bearer token for `/status` endpoint. Generate with `openssl rand -hex 32`. **Do NOT commit.** |
| `PORT` | No | HTTP port (Railway injects this; default: 9000) |
| `LOG_LEVEL` | No | Tracing filter (default: `info`) |

> **Security:** `DASHBOARD_TOKEN` must be set in Railway environment variables (or `.env`). The `/status` endpoint returns sensitive stats (earnings, node_id) and requires `Authorization: Bearer <token>`. The public `/health` endpoint returns only `{status, version, mode}`.
