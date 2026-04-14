# Changelog - SOLNET

## [2.0.0] - 2026-04-13
### Added
- **Horizontal Mesh Sharding**: Deterministic routing for DeFi, NFT, and General traffic.
- **Parallel Execution Engine**: Semaphore-based concurrency with per-account locking.
- **Geographic Edge Routing**: 8-region global model with proximity-based fallback.
- **Dynamic Load Balancer**: Adaptive strategist for upstream RPC selection.
- **Enterprise Security Middleware**: Built-detect DDoS, SQLi, XSS, and IP banning.
- **V1.1 Reward Decay**: Bitcoin-style halving every 100M requests (On-Chain).
- **Mobile Cross-Compilation**: Support for aarch64-apple-ios and aarch64-linux-android.
- **Peer Discovery SDK**: Decentralized bootstrap and auto-failover in `@solnet/client`.

### Changed
- Refactored `SharedState` for enterprise scalability.
- Standardized logging with `tracing` crate.
- Improved ZK-receipt compression efficiency.

### Fixed
- SDK hardcoded URL vulnerability.
- Upstream read errors handled via Circuit Breakers.

## [1.0.0] - 2026-04-08
- Production-ready Mainnet release.
- npm `@solnet/client` published.
- ZK-receipt batching V0.3 implemented.
