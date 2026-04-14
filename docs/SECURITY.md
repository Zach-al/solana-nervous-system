# SOLNET V2.0 Security Architecture

SOLNET is designed with a defense-in-depth approach to protect both node operators and the Solana Mainnet.

## 1. Attack Prevention Module

Every SOLNET node implements a modular security middleware that inspects all incoming traffic before it reaches the RPC processing logic.

### Rate Limiting & IP Banning
- **Dynamic Limits**: Configurable per-IP rate limits with an enterprise-ready floor of 10 req/min.
- **Auto-Banning**: IPs that violate rate limits or send malicious payloads are automatically banned from the node for 24 hours.

### Payload Scanning
- **SQLi/XSS Detection**: Payloads are scanned for common injection patterns.
- **Recursive Depth Check**: Prevents "JSON bomb" attacks by limiting the nesting depth of incoming JSON to 20 levels.
- **Size Limits**: Maximum payload size capped at 100KB to prevent memory exhaustion.

## 2. P2P Security

- **Encryption**: All P2P traffic is encrypted using Noise Protocol.
- **Onion Routing**: The SDK supports `entry-node obfuscation`, wrapping RPC requests in an encrypted layer (X25519 + AES-GCM) so the exit node cannot identify the original user IP.

## 3. Economic Security (Guardrails)

- **Reputation-Based Slashing**: Nodes that provide inconsistent or demonstrably false RPC results lose their stake.
- **Immutable Rewards**: Reward calculations and halving logic are executed strictly on-chain in the Anchor program, ensuring trustless incentives.

## 4. Reporting Vulnerabilities

Security is our top priority. If you discover a vulnerability, please report it to `security@solnet.io`. We process all reports with high priority.
