use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Response cache entry
#[derive(Clone)]
struct CacheEntry {
    value: serde_json::Value,
    cached_at: Instant,
    ttl: Duration,
    hits: u64,
}

/// Latency optimization engine
/// Multi-tier caching like Binance's matching engine
pub struct LatencyEngine {
    /// L1: Hot cache — ultra-fast responses (5s TTL)
    /// For: getSlot, getBlockHeight, getEpochInfo
    l1_cache: Arc<DashMap<String, CacheEntry>>,
    
    /// L2: Warm cache — account data (30s TTL)  
    /// For: getBalance, getAccountInfo
    l2_cache: Arc<DashMap<String, CacheEntry>>,
    
    /// L3: Cold cache — program data (5min TTL)
    /// For: getProgramAccounts, getTokenLargestAccounts
    l3_cache: Arc<DashMap<String, CacheEntry>>,
    
    /// Latency metrics per method
    latency_metrics: Arc<DashMap<String, MethodMetrics>>,
    
    /// Connection pool to upstream RPC
    pub connection_pool: Arc<ConnectionPool>,
}

#[derive(Clone, Default)]
pub struct MethodMetrics {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub total_latency_us: u64, // microseconds
    pub min_latency_us: u64,
    pub max_latency_us: u64,
    pub p50_latency_us: u64,
    pub p95_latency_us: u64,
    pub p99_latency_us: u64,
}

impl MethodMetrics {
    pub fn avg_latency_ms(&self) -> f64 {
        if self.total_requests == 0 { return 0.0; }
        (self.total_latency_us as f64 
            / self.total_requests as f64) / 1000.0
    }
    
    pub fn cache_hit_rate(&self) -> f64 {
        if self.total_requests == 0 { return 0.0; }
        self.cache_hits as f64 / self.total_requests as f64 * 100.0
    }
}

/// Cache TTL configuration per method type
pub struct CacheTtl;

impl CacheTtl {
    /// L1 methods — chain state, changes every slot (~400ms)
    /// Cache for 500ms — always fresh enough
    pub const L1_HOT: &'static [&'static str] = &[
        "getSlot",
        "getBlockHeight", 
        "getEpochInfo",
        "getVersion",
        "getHealth",
        "getIdentity",
        "getInflationRate",
    ];
    
    /// L2 methods — account state, changes on tx
    /// Cache for 2 seconds — safe for most use cases
    pub const L2_WARM: &'static [&'static str] = &[
        "getBalance",
        "getAccountInfo",
        "getMultipleAccounts",
        "getTokenAccountBalance",
        "getTokenSupply",
        "getTokenLargestAccounts",
    ];
    
    /// L3 methods — program/historical data
    /// Cache for 10 seconds — rarely changes
    pub const L3_COLD: &'static [&'static str] = &[
        "getProgramAccounts",
        "getClusterNodes",
        "getVoteAccounts",
        "getInflationGovernor",
        "getEpochSchedule",
        "getFirstAvailableBlock",
        "getGenesisHash",
    ];
    
    /// Never cache — must always be fresh
    pub const NO_CACHE: &'static [&'static str] = &[
        "sendTransaction",
        "simulateTransaction",
        "getLatestBlockhash",
        "getRecentPrioritizationFees",
        "getSignatureStatuses",
    ];
    
    pub fn get_ttl(method: &str) -> Option<Duration> {
        if Self::NO_CACHE.contains(&method) {
            return None;
        }
        if Self::L1_HOT.contains(&method) {
            return Some(Duration::from_millis(500));
        }
        if Self::L2_WARM.contains(&method) {
            return Some(Duration::from_secs(2));
        }
        if Self::L3_COLD.contains(&method) {
            return Some(Duration::from_secs(10));
        }
        // Default: 1 second for unknown methods
        Some(Duration::from_secs(1))
    }
    
    pub fn get_cache_tier(method: &str) -> u8 {
        if Self::L1_HOT.contains(&method) { return 1; }
        if Self::L2_WARM.contains(&method) { return 2; }
        if Self::L3_COLD.contains(&method) { return 3; }
        0 // no cache
    }
}

/// Build cache key from method + params
fn build_cache_key(
    method: &str, 
    params: &serde_json::Value
) -> String {
    format!("{}:{}", method, params)
}

impl LatencyEngine {
    pub fn new(pool_size: usize) -> Self {
        Self {
            l1_cache: Arc::new(DashMap::new()),
            l2_cache: Arc::new(DashMap::new()),
            l3_cache: Arc::new(DashMap::new()),
            latency_metrics: Arc::new(DashMap::new()),
            connection_pool: Arc::new(
                ConnectionPool::new(pool_size)
            ),
        }
    }
    
    /// Try to serve from cache — L1 first, then L2, L3
    pub fn get_cached(
        &self,
        method: &str,
        params: &serde_json::Value,
    ) -> Option<serde_json::Value> {
        let key = build_cache_key(method, params);
        
        let cache = match CacheTtl::get_cache_tier(method) {
            1 => &self.l1_cache,
            2 => &self.l2_cache,
            3 => &self.l3_cache,
            _ => return None,
        };
        
        if let Some(mut entry) = cache.get_mut(&key) {
            if entry.cached_at.elapsed() < entry.ttl {
                entry.hits += 1;
                // Update metrics
                let mut m = self.latency_metrics
                    .entry(method.to_string())
                    .or_default();
                m.cache_hits += 1;
                return Some(entry.value.clone());
            } else {
                drop(entry);
                cache.remove(&key); // Expired
            }
        }
        None
    }
    
    /// Store response in appropriate cache tier
    pub fn set_cache(
        &self,
        method: &str,
        params: &serde_json::Value,
        value: serde_json::Value,
    ) {
        let ttl = match CacheTtl::get_ttl(method) {
            Some(t) => t,
            None => return, // No cache for this method
        };
        
        let key = build_cache_key(method, params);
        let entry = CacheEntry {
            value,
            cached_at: Instant::now(),
            ttl,
            hits: 0,
        };
        
        match CacheTtl::get_cache_tier(method) {
            1 => { self.l1_cache.insert(key, entry); }
            2 => { self.l2_cache.insert(key, entry); }
            3 => { self.l3_cache.insert(key, entry); }
            _ => {}
        }
    }
    
    /// Record latency for a method
    pub fn record_latency(&self, method: &str, latency_us: u64) {
        let mut m = self.latency_metrics
            .entry(method.to_string())
            .or_default();
        m.total_requests += 1;
        m.total_latency_us += latency_us;
        if latency_us < m.min_latency_us || m.min_latency_us == 0 {
            m.min_latency_us = latency_us;
        }
        if latency_us > m.max_latency_us {
            m.max_latency_us = latency_us;
        }
    }
    
    /// Get performance report
    pub fn get_performance_report(&self) -> serde_json::Value {
        let mut methods = Vec::new();
        let l1_size = self.l1_cache.len();
        let l2_size = self.l2_cache.len();
        let l3_size = self.l3_cache.len();
        
        for entry in self.latency_metrics.iter() {
            let m = entry.value();
            methods.push(serde_json::json!({
                "method": entry.key(),
                "total_requests": m.total_requests,
                "cache_hits": m.cache_hits,
                "cache_hit_rate_pct": 
                    format!("{:.1}%", m.cache_hit_rate()),
                "avg_latency_ms": 
                    format!("{:.2}", m.avg_latency_ms()),
                "min_latency_ms": 
                    m.min_latency_us as f64 / 1000.0,
                "max_latency_ms": 
                    m.max_latency_us as f64 / 1000.0,
            }));
        }
        
        // Sort by total requests desc
        methods.sort_by(|a, b| {
            b["total_requests"].as_u64()
                .cmp(&a["total_requests"].as_u64())
        });
        
        serde_json::json!({
            "cache_sizes": {
                "l1_hot": l1_size,
                "l2_warm": l2_size,
                "l3_cold": l3_size,
                "total": l1_size + l2_size + l3_size,
            },
            "methods": methods,
            "target_latency_ms": {
                "cached": "<1ms",
                "uncached": "<50ms",
                "helius_baseline": "~80ms",
            }
        })
    }
    
    /// Evict expired entries from all caches
    pub fn evict_expired(&self) {
        let now = Instant::now();
        
        for cache in [&self.l1_cache, &self.l2_cache, 
                       &self.l3_cache] 
        {
            cache.retain(|_, v| {
                now.duration_since(v.cached_at) < v.ttl
            });
        }
    }
}

/// HTTP connection pool for upstream RPC
/// Pre-warmed connections = zero TCP handshake overhead
pub struct ConnectionPool {
    client: reqwest::Client,
}

impl ConnectionPool {
    pub fn new(pool_size: usize) -> Self {
        let client = reqwest::Client::builder()
            // Keep connections alive — eliminates TCP overhead
            .pool_max_idle_per_host(pool_size)
            .pool_idle_timeout(Duration::from_secs(90))
            // TCP_NODELAY — disables Nagle's algorithm
            // Sends packets immediately — critical for latency
            .tcp_nodelay(true)
            // Connection timeout
            .connect_timeout(Duration::from_secs(3))
            // Request timeout
            .timeout(Duration::from_secs(10))
            // HTTP/2 for multiplexing
            .http2_prior_knowledge()
            // Reuse connections aggressively
            .connection_verbose(false)
            .build()
            .expect("Failed to build connection pool");
            
        Self { client }
    }
    
    pub fn get_client(&self) -> &reqwest::Client {
        &self.client
    }
}
