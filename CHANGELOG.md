# Changelog

All notable changes to the SOLNET (Solana Nervous System) project will be documented in this file.

## [1.0.0] - Mainnet Ready - 2026-04-13
### Added
- **NPM SDK**: `@solnet/client` drop-in replacement for `@solana/web3.js`.
- **SOLNET Token**: SPL Token implementation for incentives and governance.
- **Node Rewards**: Automatic minting of 10 SOLNET per RPC request served.
- **Priority Staking**: `stake_for_priority` instruction to allow nodes to lock tokens for traffic prioritization.
- **Landing Page**: New stunning `/landing` page for protocol discovery.

## [0.4.0] - Privacy Layer - 2026-04-13
### Added
- **Onion Routing**: Layered AES-256-GCM and X25519 ECDH encryption for requests.
- **Privacy Dashboard**: Real-time privacy score and anonymity indicators.
- **Daily Salt Rotation**: Cryptographical obfuscation of client IPs in settlement receipts.

## [0.3.0] - ZK Settlement - 2026-04-13
### Added
- **ZK-Compressed Batching**: 1000x cost reduction via Merkle tree aggregation.
- **BatchRecord PDA**: native on-chain replay protection for settlements.

## [0.2.0] - Verification - 2026-04-13
### Added
- **Cryptographic Response Verification**: Merkle proofs for client-side trustless validation.
- **Slot Cache**: Background task to optimize `getSlot` calls.

## [0.1.0] - Prototype - 2026-04-06
### Added
- Initial P2P daemon and RPC proxy.
- Basic stats dashboard.
- Anchor settlement program.
