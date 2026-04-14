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

## 4. Mobile & Light Node Architecture (V1.2)

To enable SOLNET on low-power devices, we introduced the **Light Node** specification.

### HTTP Registration (P2P-Lite)
Mobile nodes do not participate in the heavy libp2p Kademlia DHT. Instead, they use a lightweight HTTP registration flow:
1.  **Identity Generation:** The mobile node generates a unique deterministic Peer ID.
2.  **Bootstrap Handshake:** The node connects to a hardcoded list of Bootstrap Nodes via `/mobile/register`.
3.  **Peer Assignment:** The network assigning a geographically close "Anchor Node" (Desktop Full Node) to the mobile node.

### Delegated Routing
All RPC requests from a mobile node are tunnelled through its assigned Anchor Node. This reduces the mobile node's active socket count and background processing from thousands of peers to a single stable connection, drastically increasing battery life.

### Battery-Aware Throttling (Battery Guard)
The Light Node daemon integrates with the OS battery API. As battery levels drop, the node dynamically adjusts its "Routing Priority" (QoS). At critical levels (< 20%), the node stops processing external requests but maintains its mesh identity for easy resumption when power is restored.
