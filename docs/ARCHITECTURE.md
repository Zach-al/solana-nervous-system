# SOLNET V2.0 System Architecture

SOLNET is a decentralized, peer-to-peer RPC mesh designed to scale the Solana Nervous System.

## 1. Core Components

### The Mesh (P2P Layer)
Built on `libp2p`, the mesh handles node discovery, geographic ranking, and shard specialty broadcasting. Nodes are not just general-purpose proxies; they are specialized shards.

### Sharding & Specialization
SOLNET implements horizontal mesh sharding. Nodes specialize in specific traffic types:
- **DeFi Shard**: Optimized for `sendTransaction`, `getLatestBlockhash`, and account balance checks.
- **NFT Shard**: Specializes in `getProgramAccounts` and metadata-heavy queries.
- **General Shard**: Handles all other traffic.

### Parallel Execution (Sealevel-Inspired)
To ensure high throughput, the daemon uses a Semaphore-based concurrency controller. 
- Conflicts are managed via a `DashMap` of account locks.
- Non-conflicting RPC requests proceed in parallel, utilizing all available CPU cores.

## 2. Request Lifecycle

1. **SDK Discovery**: The client identifies the nearest and fastest healthy node using the `PeerDiscovery` module.
2. **Onion Wrapping**: (Optional) The request is wrapped in a layer of encryption for privacy.
3. **Security Middleware**: The ingress node checks for bans, rate limits, and malicious patterns.
4. **Shard Routing**: If the ingress node does not specialize in the requested method, it deterministicly routes the request to a specialized shard in the same geographic region.
5. **Parallel Processing**: The request is processed using the local parallel execution engine.
6. **Proof Generation**: A Merkle Proof of the result is injected into the response.
7. **On-Chain Settlement**: The request is batched and settled on-chain every hour.

## 3. Geographic Edge Routing

SOLNET uses an 8-region global model (`USEast`, `EuropeWest`, etc.). Nodes automatically calculate latency to peers and prioritize routing within their own or adjacent regions to minimize global latency.
If a regional shard is unavailable, the "Nervous System" triggers a fallback to the local validator, ensuring 100% uptime.

## 4. Networking Layer (V1.2)

Transport: TCP + QUIC (dual stack, port 9001)
Encryption: Noise protocol (all connections)
Multiplexing: Yamux
Discovery: Kademlia DHT
NAT Detection: AutoNAT
Relay: Circuit Relay v2 (Railway node)
Hole Punching: DCUtR (direct connection upgrade)
Identity: Ed25519 keypair (stable across restarts)

Peer discovery flow:
1. Node generates/loads Ed25519 keypair → stable Peer ID
2. Connects to `SOLNET_BOOTSTRAP` relay node
3. AutoNAT determines: PublicAddress/Private/Symmetric
4. Kademlia bootstraps from relay, discovers mesh peers
5. DCUtR attempts hole punch with each new peer
6. Success → direct TCP/QUIC connection established
7. Failure → stays on relay circuit (still works)

### Battery-Aware Throttling (Battery Guard)
The Light Node daemon integrates with the OS battery API. As battery levels drop, the node dynamically adjusts its "Routing Priority" (QoS). At critical levels (< 20%), the node stops processing external requests but maintains its mesh identity for easy resumption when power is restored.
