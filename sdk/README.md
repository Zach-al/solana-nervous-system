# solnet-sdk

> High-availability decentralized RPC infrastructure for the Solana network. Optimizes request routing, minimizes latency through edge-caching, and provides resilient access to blockchain state via a community-owned mesh protocol.

[![npm version](https://badge.fury.io/js/solnet-sdk.svg)](https://www.npmjs.com/package/solnet-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## Integration Guide

```bash
npm install solnet-sdk
```

```typescript
// BEFORE — one company controls your uptime
import { Connection } from '@solana/web3.js'
const connection = new Connection(
  'https://api.mainnet-beta.solana.com'
)

// AFTER — decentralized mesh, zero single point of failure
import { SolnetConnection } from 'solnet-sdk'
const connection = new SolnetConnection()

// Everything else stays identical. Zero code changes.
const balance = await connection.getBalance(publicKey)
const slot = await connection.getSlot()
const tx = await connection.sendTransaction(transaction)
```

## Why SOLNET?

Today every Solana app secretly routes through 2-3 
centralized companies. If they go down, your app goes down.
SOLNET replaces them with a self-healing P2P mesh where 
thousands of independent nodes route your traffic and earn 
SOL for doing it.

| | Standard RPC | SOLNET |
|---|---|---|
| Single point of failure | YES | NO |
| Monthly cost | $500+ | ~$350 |
| Censorship resistant | NO | YES |
| Response verification | NO | YES |
| Privacy mode | NO | YES |
| Open source | NO | YES |

## Advanced Configuration

```typescript
import { SolnetConnection } from 'solnet-sdk'

const connection = new SolnetConnection({
  // Your node or the public SOLNET network
  endpoint: 'https://solnet-production.up.railway.app',
  
  // Auto-fallback if SOLNET unreachable (silent)
  fallback: 'https://api.mainnet-beta.solana.com',
  
  // Request timeout
  timeoutMs: 8000,
  
  // Onion routing — hides your IP from node operators
  privacy: true,
  
  // Merkle proof verification on every response
  verify: true,
  
  // Called when falling back to standard RPC
  onFallback: (reason) => {
    console.warn('SOLNET fallback:', reason)
  },
  
  // Called on every cryptographically verified response
  onVerified: (proof) => {
    console.log('Verified at slot:', proof.slot)
  },

  // Client Telemetry Routing (Enterprise Feature)
  // Route underlying network telemetry to your own observability stack
  telemetryEndpoint: 'https://metrics.your-enterprise.com/ingest',
})
```

## Node Stats

```typescript
// Check your node earnings and uptime
const stats = await connection.getNodeStats()
console.log(`Earned: ${stats.earningsSol} SOL`)
console.log(`Requests: ${stats.requestsServed}`)
console.log(`Uptime: ${stats.uptimeSeconds}s`)

// Session analytics
const session = connection.getSessionStats()
console.log(`Reliability: ${session.reliability}`)
```

## Run Your Own Node

Earn SOL by running a SOLNET node on any device:

```bash
git clone https://github.com/Zach-al/solana-nervous-system
cd solana-nervous-system/sns-daemon
cargo run --release
```

Your device joins the mesh and starts earning SOL 
automatically for every request it routes.

## Privacy & Telemetry

solnet-sdk sends anonymous performance metrics:
- Request success/failure counts
- Hole punch success rates
- Latency percentiles
- SDK version

No IP addresses. No wallet addresses. No PII. Ever.

Opt out at any time:
// Node.js
process.env.SOLNET_NO_TELEMETRY = 'true'

// Browser
localStorage.setItem('SOLNET_NO_TELEMETRY', 'true')

## Links
- GitHub: https://github.com/Zach-al/solana-nervous-system
- Dashboard: https://solnet.vercel.app
- Node: https://solnet-production.up.railway.app/health

## License
MIT — © 2026 SOLNET Enterprise. All rights reserved.
