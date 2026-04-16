use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct TelemetryCollector {
    enabled: bool,
    // Aggregate counters only — no PII
    hole_punch_attempts: Arc<AtomicU64>,
    hole_punch_successes: Arc<AtomicU64>,
    total_requests: Arc<AtomicU64>,
    total_peers_seen: Arc<AtomicU64>,
    uptime_start: std::time::Instant,
    version: String,
    // Telemetry endpoint
    endpoint: String,
}

impl Default for TelemetryCollector {
    fn default() -> Self {
        Self::new()
    }
}

impl TelemetryCollector {
    pub fn new() -> Self {
        let enabled = std::env::var("SOLNET_NO_TELEMETRY")
            .map(|v| v != "true")
            .unwrap_or(true);
        
        if enabled {
            tracing::info!(
                "Telemetry enabled (opt-out: \
                 SOLNET_NO_TELEMETRY=true)"
            );
        }

        Self {
            enabled,
            hole_punch_attempts: Arc::new(
                AtomicU64::new(0)
            ),
            hole_punch_successes: Arc::new(
                AtomicU64::new(0)
            ),
            total_requests: Arc::new(AtomicU64::new(0)),
            total_peers_seen: Arc::new(AtomicU64::new(0)),
            uptime_start: std::time::Instant::now(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            endpoint: std::env::var("SOLNET_TELEMETRY_URL")
                .unwrap_or_else(|_| 
                    "https://solnet-production.up.railway.app\
                     /telemetry/ingest".to_string()
                ),
        }
    }

    pub fn record_hole_punch_attempt(&self) {
        self.hole_punch_attempts
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_hole_punch_success(&self) {
        self.hole_punch_successes
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_request(&self) {
        self.total_requests.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_new_peer(&self) {
        self.total_peers_seen
            .fetch_add(1, Ordering::Relaxed);
    }

    /// Send heartbeat every 5 minutes
    /// Contains only aggregate metrics — zero PII
    pub async fn send_heartbeat(&self) {
        if !self.enabled {
            return;
        }

        let attempts = self.hole_punch_attempts
            .load(Ordering::Relaxed);
        let successes = self.hole_punch_successes
            .load(Ordering::Relaxed);
        let requests = self.total_requests
            .load(Ordering::Relaxed);
        let peers = self.total_peers_seen
            .load(Ordering::Relaxed);
        let uptime = self.uptime_start
            .elapsed()
            .as_secs();

        let punch_rate = if attempts > 0 {
            successes as f64 / attempts as f64 * 100.0
        } else {
            0.0
        };

        let payload = serde_json::json!({
            "v": self.version,
            "event": "heartbeat",
            "uptime_secs": uptime,
            "requests": requests,
            "peers_seen": peers,
            "hole_punch_attempts": attempts,
            "hole_punch_successes": successes,
            "hole_punch_rate_pct": punch_rate,
            // No IP, no wallet, no PII
        });

        let client = reqwest::Client::new();
        let _ = client
            .post(&self.endpoint)
            .json(&payload)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await;
        // Silently ignore errors — telemetry never
        // blocks the node
    }
}
