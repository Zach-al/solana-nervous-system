# SOLNET: The Decentralized Nervous System for Solana

SOLNET is a high-performance, decentralized Physical Infrastructure Network (DePIN) that democratizes Solana’s RPC layer. By turning millions of consumer devices into a resilient, peer-to-peer mesh, SOLNET eliminates the single points of failure inherent in centralized RPC providers while rewarding node operators for contributing bandwidth and compute.

## Why SOLNET?

As Solana scales, RPC congestion has become a critical bottleneck. Centralized providers are susceptible to outages, censorship, and latency spikes. SOLNET solves this by migrating the network's "Nervous System" to the edge.

- **Resilience**: A decentralized p2p mesh that routes around outages automatically.
- **Latency**: Sub-50ms RPC responses via geographic routing and edge processing.
- **Incentives**: Node operators earn SOL rewards for every request successfully served.
- **Privacy**: Zero-knowledge routing and end-to-end encrypted tunnels.

---

## Technical Architecture

SOLNET is built on a custom, high-performance stack designed for the unique constraints of mobile and edge hardware.

### The Engine (Rust Core)
The heart of SOLNET is written in **Rust**, utilizing `libp2p` for decentralized networking and `tokio` for high-concurrency request handling. The daemon runs natively on Android and iOS via a low-latency JNI/FFI bridge, providing military-grade security and performance that standard JS-based solutions cannot achieve.

### The Bridge (JNI / FFI)
We utilize a custom-built native bridge to expose high-level control to the React Native UI while keeping the heavy lifting (cryptography, DHT discovery, request routing) in a memory-safe, hardware-accelerated Rust environment.

### The Protocol (Solana / Anchor)
Node status, rank, and reward settlements are managed by the **SOLNET Anchor Program**. The protocol uses a proof-of-service model to ensure that rewards are distributed fairly based on verified throughput and uptime.

---

## Technical Highlights

- **Native Resolution Architecture**: A custom Metro responder designed for pnpm workspaces, specifically optimized for high-performance monorepos.
- **Entropy Persistence**: Uses native Android/iOS secure hardware (OsRng) to back the Rust crypto engine.
- **Automatic Throttling**: Intelligent power management that adjusts node activity based on device battery, temperature, and connectivity.
- **PeerGuard Security**: An HMAC-SHA256 based mitigation layer that protects nodes from DDOS and replay attacks.

---

## Quick Start (Mobile)

1. **Connect**: Link your Solana wallet via the SOLNET Dashboard.
2. **Activate**: One-swipe activation to start the native Rust reactor.
3. **Earn**: Monitor real-time logs and SOL rewards as your device stabilizes the network.

---

## For Engineers

### Repository Structure
- `/sns-daemon`: High-concurrency Rust daemon (Node logic).
- `/mobile-app`: React Native control center with JNI native bridge.
- `/sns-program`: Anchor-based settlement and rank protocol.
- `/sdk`: Drop-in `solnet-sdk` for developers to connect to the mesh.

### Building from Source

**Android Release Build:**
```bash
cd mobile-app
# Generates the production-ready APK
npx expo run:android --variant release
```

**Daemon Local Build:**
```bash
cd sns-daemon
cargo build --release
```

---

## Investing in Resilience

SOLNET is more than a tool; it is infrastructure. By decentralizing the entry point to the Solana blockchain, we are making the ecosystem censorship-resistant and physically robust. We are building the substrate for the next generation of truly decentralized applications.

---

© 2026 SOLNET. Built for Solana. MIT Licensed.
