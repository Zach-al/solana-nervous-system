# SOLNET V2.0 Enterprise User Guide

Welcome to SOLNET V2.0, the enterprise-grade decentralized RPC infrastructure for the Solana Mainnet. This guide covers node operation, SDK integration, and network participation.

## 1. Node Operator Setup

### Prerequisites
- Rust 1.75+
- 4 vCPUs, 8GB RAM (Minimum)
- Stable 100Mbps+ connection
- 0.1 SOL for staking

### Installation
Run the following command to build the daemon:
```bash
make build-release
```

### Configuration
Configure your node using environment variables:
- `SOLANA_RPC_URL`: Your local or trusted validator endpoint.
- `SOLNET_SHARD`: `DeFi`, `NFT`, or `General` (Specializes your node).
- `SOLNET_REGION`: Your geographic region (e.g., `us-east`, `europe-west`).
- `RATE_LIMIT`: Per-minute limit for client IPs (Default: 100).
- `MAX_CONCURRENT`: Global semaphore limit for parallel execution.

### Execution
```bash
cd sns-daemon && cargo run --release
```

## 2. SDK Integration (@solnet/client)

Integrate SOLNET into your dApp significantly reducing RPC costs while gaining privacy and resilience.

### Installation
```bash
npm install @solnet/client
```

### Usage
```typescript
import { SolnetConnection } from '@solnet/client';

// The SDK automatically discovers the best peer in the mesh
const connection = new SolnetConnection({
  commitment: 'confirmed',
  privacy: true // Enables 1-layer entry-node privacy
});

const slot = await connection.getSlot();
console.log(`Current Slot: ${slot}`);
```

## 3. Economic Flywheel

Node operators earn SOLNET tokens for every verified request served. 
- **Rewards**: 10 tokens per request (initial).
- **Decay**: Halving occurs every 100,000,000 requests globally.
- **Settlement**: Batches are settled on-chain hourly using ZK-compressed proofs.

## 4. Support

For enterprise support or integration assistance, contact `enterprise@solnet.io` or join our Discord.
