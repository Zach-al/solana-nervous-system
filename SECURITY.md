# SOLNET Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.1.x   | ✅ Yes    |
| < 2.0   | ❌ No     |

## CVE Patch Status

| CVE | Severity | Status | Fixed In |
|-----|----------|--------|---------|
| CVE-2026-35405 | Critical 9.8 | ✅ Patched | V2.1 |
| CVE-2026-Gossipsub | Critical | ✅ Not Used | N/A |
| Yamux OOM | High | ✅ Patched | V2.1 |

## Threat Model

### Assets Protected
1. Node operator SOL earnings
2. Client transaction privacy
3. Network availability (anti-DoS)
4. Peer identity integrity

### Attack Vectors Mitigated

#### Network Layer
- Resource exhaustion: ConnectionLimits behaviour (max 250 inbound, max 3 per peer)
- Yamux OOM: Updated to patched yamux version
- Stream spam: max_negotiating_inbound_streams=10
- Slow connection: idle_connection_timeout=30s
- Sybil attacks: PeerGuard reputation scoring
- Rendezvous OOM: Feature not used (CVE-2026-35405)
- Gossipsub panic: Feature not used

#### Application Layer
- JSON injection: Method whitelist (50 methods)
- Payload bombs: 100KB size limit, depth limit 20
- Replay attacks: 30s timestamp window + nonces
- Rate limiting: 100 req/min per IP, auto-ban
- DDoS: Circuit breaker, global semaphore 500 req

#### Privacy Layer
- IP exposure: Onion routing (AES-256-GCM + X25519)
- Receipt linkability: Daily rotating salt SHA256
- Telemetry: Opt-out, zero PII, aggregates only

#### Smart Contract Layer
- Overflow: checked_add/checked_mul everywhere
- Reentrancy: instruction ordering
- Double-settle: BatchRecord PDA uniqueness
- Unauthorized: Signer verification on all instructions

## Responsible Disclosure

Found a vulnerability in SOLNET?

1. Do NOT open a public GitHub issue
2. Email: askzachn@gmail.com
3. Include: description, reproduction steps, impact
4. We respond within 48 hours
5. Credit given in CHANGELOG for valid reports

We do not have a bug bounty program yet.
Mainnet launch will include one.

## Audit History

| Date | Auditor | Scope | Report |
|------|---------|-------|--------|
| Pending | Hashlock | Full stack | — |
