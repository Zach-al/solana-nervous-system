# SOLANA NERVOUS SYSTEM (SOLNET) 🧠 

**Enterprise Release V2.1.1** — *Decentralized RPC Mesh Protocol*

SOLNET is a military-grade decentralized RPC proxy and mesh network built for the Solana ecosystem. It serves as a "nervous system" for the blockchain, routing traffic through a hardened mesh of nodes to ensure 100% uptime and resistance to centralized point-of-failure.

[![SOLNET Production](https://img.shields.io/badge/Production-V2.1.1-blueviolet)](https://solnet-production.up.railway.app)
[![Security Audit](https://img.shields.io/badge/Audit-Hashlock_Pending-yellow)](https://hashlock.com)

## 🏗 Infrastructure Status
- **Daemon**: [Railway (Production)](https://solnet-production.up.railway.app)
- **Dashboard**: [Vercel (Production)](https://solana-nervous-system.vercel.app)
- **Smart Contract**: SOLNet_v2_Enterprise (Mainnet Beta)

## 🛡 Security Posture (Absolute Hardening)
The V2.1.1 release implements the following security measures for Hashlock audit readiness:
- **Dependency Pinning**: All critical crates (`openssl`, `rustls`, `time`) pinned to non-vulnerable versions.
- **Feature Stripping**: Removed `gossipsub`, `mdns`, and `rendezvous` from LibP2P to eliminate attack vectors.
- **Port Masking**: Production daemon strictly binds to dynamic `$PORT` with `0.0.0.0` exposure restricted by Railway Edge.
- **Memory Safety**: Rust 2021 edition with `panic = "abort"` and `LTO = true` for immutable binary state.

## 🚀 Deployment (V2.1.1 Hotfix)
The current deployment resolves the **Railway 502 Bad Gateway** by:
1. Using **Nixpacks** builder for memory-efficient compilation.
2. Synchronous **SIGTERM** handling for graceful rollouts.
3. Decoupled **RPC/P2P** ports with strict Railway health check paths.

## 👨‍💻 Local Development
```bash
# Build the daemon
cd sns-daemon
cargo build --release

# Run locally (defaults to port 9000)
./target/release/sns-daemon
```

*© 2026 SOLNET Enterprise. All Rights Reserved.*
