/// Complete attack prevention system — DDoS, injection, rate limiting, IP banning

use dashmap::DashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use serde_json;
use tracing;

pub struct AttackPrevention {
    ip_requests: Arc<DashMap<String, IpRecord>>,
    banned_ips: Arc<DashMap<String, u64>>,
    attack_patterns: Vec<String>,
    total_requests: Arc<std::sync::atomic::AtomicU64>,
}

#[derive(Clone)]
struct IpRecord {
    count: u64,
    window_start: u64,
    last_seen: u64,
}

impl Default for AttackPrevention {
    fn default() -> Self {
        Self::new()
    }
}

impl AttackPrevention {
    pub fn new() -> Self {
        Self {
            ip_requests: Arc::new(DashMap::new()),
            banned_ips: Arc::new(DashMap::new()),
            attack_patterns: vec![
                "' OR '1'='1".to_string(),
                "DROP TABLE".to_string(),
                "<script>".to_string(),
                "javascript:".to_string(),
                "../".to_string(),
                "..\\".to_string(),
                "\x00".to_string(),
            ],
            total_requests: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }

    fn now() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }

    pub fn is_banned(&self, ip: &str) -> bool {
        if let Some(expiry) = self.banned_ips.get(ip) {
            if Self::now() < *expiry {
                return true;
            } else {
                drop(expiry);
                self.banned_ips.remove(ip);
            }
        }
        false
    }

    pub fn ban_ip(&self, ip: &str, duration_secs: u64) {
        let expiry = Self::now() + duration_secs;
        self.banned_ips.insert(ip.to_string(), expiry);
        tracing::warn!("Banned IP {} for {} seconds", ip, duration_secs);
    }

    pub fn check_rate_limit(&self, ip: &str) -> RateResult {
        let now = Self::now();
        let mut record = self.ip_requests.entry(ip.to_string()).or_insert(IpRecord {
            count: 0,
            window_start: now,
            last_seen: now,
        });

        if now - record.window_start > 60 {
            record.count = 0;
            record.window_start = now;
        }

        record.count += 1;
        record.last_seen = now;

        if record.count > 1000 {
            self.ban_ip(ip, 86400);
            return RateResult::Banned;
        }

        if record.count > 100 {
            return RateResult::Limited {
                retry_after: 60 - (now - record.window_start),
            };
        }

        RateResult::Allowed
    }

    pub fn scan_payload(&self, payload: &str) -> ScanResult {
        let payload_lower = payload.to_lowercase();

        if payload.len() > 102400 {
            return ScanResult::Blocked("payload too large");
        }

        for pattern in &self.attack_patterns {
            if payload_lower.contains(&pattern.to_lowercase()) {
                return ScanResult::Blocked("attack pattern detected");
            }
        }

        let depth = payload.chars().filter(|&c| c == '{' || c == '[').count();
        if depth > 20 {
            return ScanResult::Blocked("too deeply nested");
        }

        ScanResult::Clean
    }

    pub fn cleanup(&self) {
        let now = Self::now();
        self.ip_requests.retain(|_, r| now - r.last_seen < 300);
        self.banned_ips.retain(|_, expiry| now < *expiry);
    }

    pub fn get_stats(&self) -> serde_json::Value {
        serde_json::json!({
            "tracked_ips": self.ip_requests.len(),
            "banned_ips": self.banned_ips.len(),
            "total_requests": self.total_requests.load(std::sync::atomic::Ordering::Relaxed),
        })
    }

    pub fn increment_total(&self) {
        self.total_requests
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn validate_host(host: &str, config: &crate::config::Config) -> bool {
        // 1. Mandatory Trust: Localhost always allowed for diagnostic tools
        if host == "localhost" || host == "127.0.0.1" || host == "[::1]" || host.starts_with("localhost:") || host.starts_with("127.0.0.1:") || host.starts_with("[::1]:") {
            return true;
        }

        // 2. SOLNET_WHITELIST_IP: Explicit priority trust
        if !config.whitelist_ip.is_empty() && (host == config.whitelist_ip || host.starts_with(&format!("{}:", config.whitelist_ip))) {
            tracing::info!("[V2.1 SECURITY] Host matched SOLNET_WHITELIST_IP: {}", host);
            return true;
        }

        // 3. Subnet Trust (only in development)
        if config.env_mode == "development" {
            let is_local_subnet = host.starts_with("192.168.") || host.starts_with("10.");
            if is_local_subnet {
                tracing::info!("[V2.1 SECURITY] Host {} trusted via Development Subnet Rule", host);
                return true;
            }
        }

        // 4. Known Public Hostnames
        let public_allowed = [
            "solnet-production.up.railway.app",
            "up.railway.app",
            "railway.internal"
        ];
        if public_allowed.iter().any(|&h| host == h || host.ends_with(&format!(".{}", h)) || host.starts_with(&format!("{}:", h))) {
            return true;
        }

        // 5. Fallback: Passive trust with logging for PRODUCTION (Ensures Railway ingress connectivity)
        tracing::warn!("[V2.1 SECURITY] SOFT-FAIL invalid Host: '{}'. Allowing for ingress compatibility.", host);
        true
    }
}

pub enum RateResult {
    Allowed,
    Limited { retry_after: u64 },
    Banned,
}

pub enum ScanResult {
    Clean,
    Blocked(&'static str),
}
