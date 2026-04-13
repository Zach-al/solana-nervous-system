use dashmap::DashMap;
use hmac::{Hmac, Mac};

use sha2::Sha256;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

// ─────────────────────────────────────────────────────────────
// 1. REQUEST SIGNING — HMAC-SHA256
// Every inter-node request must include a valid HMAC signature
// and a timestamp. Requests older than 30s are rejected
// to prevent replay attacks.
// ─────────────────────────────────────────────────────────────

#[allow(dead_code)]
pub struct RequestSigner {
    secret_key: String,
}

#[allow(dead_code)]
impl RequestSigner {
    pub fn new(secret: String) -> Self {
        Self {
            secret_key: secret,
        }
    }

    pub fn sign(&self, payload: &str, timestamp: u64) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(
            self.secret_key.as_bytes(),
        )
        .expect("HMAC can take key of any size");
        mac.update(format!("{}{}", payload, timestamp).as_bytes());
        hex::encode(mac.finalize().into_bytes())
    }

    pub fn verify(&self, payload: &str, timestamp: u64, signature: &str) -> bool {
        // Reject requests older than 30 seconds (replay attack prevention)
        let now = now_secs();
        if now.saturating_sub(timestamp) > 30 {
            return false;
        }
        let expected = self.sign(payload, timestamp);
        // Constant-time comparison (prevents timing oracle attacks)
        constant_time_eq(&expected, signature)
    }
}

#[allow(dead_code)]
fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.bytes()
        .zip(b.bytes())
        .fold(0u8, |acc, (x, y)| acc | (x ^ y))
        == 0
}

// ─────────────────────────────────────────────────────────────
// 2. RATE LIMITER — per IP, 100 req/min sliding window
// IPs that exceed the limit are blocked for the remainder
// of the 60-second window. State auto-cleans after 5 min.
// ─────────────────────────────────────────────────────────────

pub struct RateLimiter {
    // (request_count, window_start_timestamp)
    requests: Arc<DashMap<String, (u64, u64)>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            requests: Arc::new(DashMap::new()),
        }
    }

    /// Returns true if the request is allowed, false if rate limited.
    pub fn check(&self, ip: &str) -> bool {
        let now = now_secs();
        let mut entry = self.requests.entry(ip.to_string()).or_insert((0, now));

        // Reset window every 60 seconds
        if now.saturating_sub(entry.1) > 60 {
            entry.0 = 0;
            entry.1 = now;
        }

        entry.0 += 1;
        entry.0 <= 100 // allow max 100 req/min
    }

    /// Clean up entries older than 5 minutes. Call periodically from a background task.
    pub fn cleanup(&self) {
        let now = now_secs();
        self.requests.retain(|_, v| now.saturating_sub(v.1) < 300);
    }
}

// ─────────────────────────────────────────────────────────────
// 3. INPUT SANITIZER — JSON-RPC whitelist + depth check
// Only known Solana RPC methods are allowed.
// Payloads > 100 KB or nested > 5 levels deep are rejected.
// ─────────────────────────────────────────────────────────────

pub struct InputSanitizer;

impl InputSanitizer {
    /// Whitelist of all valid Solana JSON-RPC methods.
    /// Any method not in this list returns HTTP 400.
    const ALLOWED_METHODS: &'static [&'static str] = &[
        "getAccountInfo",
        "getBalance",
        "getBlock",
        "getBlockHeight",
        "getBlockProduction",
        "getBlockCommitment",
        "getBlocks",
        "getBlockTime",
        "getClusterNodes",
        "getEpochInfo",
        "getEpochSchedule",
        "getFeeForMessage",
        "getFirstAvailableBlock",
        "getGenesisHash",
        "getHealth",
        "getHighestSnapshotSlot",
        "getIdentity",
        "getInflationGovernor",
        "getInflationRate",
        "getInflationReward",
        "getLargestAccounts",
        "getLatestBlockhash",
        "getLeaderSchedule",
        "getMaxRetransmitSlot",
        "getMaxShredInsertSlot",
        "getMinimumBalanceForRentExemption",
        "getMultipleAccounts",
        "getProgramAccounts",
        "getRecentPerformanceSamples",
        "getRecentPrioritizationFees",
        "getSignaturesForAddress",
        "getSignatureStatuses",
        "getSlot",
        "getSlotLeader",
        "getSlotLeaders",
        "getStakeActivation",
        "getStakeMinimumDelegation",
        "getSupply",
        "getTokenAccountBalance",
        "getTokenAccountsByDelegate",
        "getTokenAccountsByOwner",
        "getTokenLargestAccounts",
        "getTokenSupply",
        "getTransaction",
        "getTransactionCount",
        "getVersion",
        "getVoteAccounts",
        "isBlockhashValid",
        "minimumLedgerSlot",
        "requestAirdrop",
        "sendTransaction",
        "simulateTransaction",
    ];

    pub fn validate(payload: &serde_json::Value) -> Result<(), String> {
        // Must have jsonrpc field
        if payload.get("jsonrpc").is_none() {
            return Err("missing jsonrpc field".into());
        }

        // Must have method field and it must be a string
        let method = payload
            .get("method")
            .and_then(|m| m.as_str())
            .ok_or("missing or invalid method")?;

        // Method must be in whitelist
        if !Self::ALLOWED_METHODS.contains(&method) {
            return Err(format!("method not allowed: {}", method));
        }

        // Payload size limit: 100 KB max
        let payload_str = payload.to_string();
        if payload_str.len() > 102_400 {
            return Err("payload too large".into());
        }

        // No nested objects deeper than 5 levels (prevents JSON bomb attacks)
        if Self::depth(payload) > 5 {
            return Err("payload too deeply nested".into());
        }

        Ok(())
    }

    fn depth(value: &serde_json::Value) -> usize {
        match value {
            serde_json::Value::Object(map) => {
                1 + map.values().map(Self::depth).max().unwrap_or(0)
            }
            serde_json::Value::Array(arr) => {
                1 + arr.iter().map(Self::depth).max().unwrap_or(0)
            }
            _ => 0,
        }
    }
}

// ─────────────────────────────────────────────────────────────
// 4. CIRCUIT BREAKER
// If the upstream Solana RPC fails 5+ times in a row,
// stop forwarding for 30s to avoid hammering a dead endpoint.
// ─────────────────────────────────────────────────────────────

pub struct CircuitBreaker {
    failures: Arc<std::sync::atomic::AtomicU32>,
    last_failure: Arc<std::sync::Mutex<u64>>,
    threshold: u32,
    recovery_secs: u64,
}

impl CircuitBreaker {
    pub fn new() -> Self {
        Self {
            failures: Arc::new(std::sync::atomic::AtomicU32::new(0)),
            last_failure: Arc::new(std::sync::Mutex::new(0)),
            threshold: 5,
            recovery_secs: 30,
        }
    }

    /// Returns true if the circuit is open (upstream is down — reject request).
    pub fn is_open(&self) -> bool {
        let failures = self
            .failures
            .load(std::sync::atomic::Ordering::Relaxed);
        if failures < self.threshold {
            return false;
        }
        let now = now_secs();
        let last = *self.last_failure.lock().unwrap();
        now.saturating_sub(last) < self.recovery_secs
    }

    pub fn record_failure(&self) {
        self.failures
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        *self.last_failure.lock().unwrap() = now_secs();
    }

    pub fn record_success(&self) {
        self.failures
            .store(0, std::sync::atomic::Ordering::Relaxed);
    }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock after UNIX epoch")
        .as_secs()
}
