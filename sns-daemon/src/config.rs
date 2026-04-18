use std::env;
use crate::sharding::ShardType;
use crate::geo_router::Region;

#[derive(Debug, Clone)]
pub struct Config {
    pub solana_rpc_url: String,
    pub http_port: u16,
    pub p2p_port: u16,
    pub node_name: String,
    pub log_level: String,
    // V2.0 Enterprise Fields
    pub shard_type: ShardType,
    pub region: Region,
    pub max_concurrent_requests: usize,
    pub rate_limit_per_min: u64,
    pub node_wallet_pubkey: String,
    pub is_relay: bool,
    pub relay_max_reservations: usize,
    pub relay_max_circuits: usize,
    pub enable_dcutr: bool,
    pub bootstrap_nodes: Vec<String>,
    pub env_mode: String,
    pub whitelist_ip: String,
    pub telemetry_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        let shard_str = env::var("SOLNET_SHARD").unwrap_or_else(|_| "general".to_string());
        let shard_type = match shard_str.to_lowercase().as_str() {
            "defi" => ShardType::DeFi,
            "nft" => ShardType::NFT,
            _ => ShardType::General,
        };

        let region_str = env::var("SOLNET_REGION").unwrap_or_else(|_| "asia-south".to_string());
        let region = Region::from_env_str(&region_str);

        let max_concurrent = env::var("MAX_CONCURRENT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(100);

        let rate_limit = env::var("RATE_LIMIT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(100)
            .max(10); // Floor of 10 as per user instruction

        let is_relay = env::var("SOLNET_IS_RELAY")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(false);

        let bootstrap_nodes = env::var("SOLNET_BOOTSTRAP")
            .unwrap_or_default()
            .split(',')
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.trim().to_string())
            .collect();

        let relay_max_reservations = env::var("RELAY_MAX_RESERVATIONS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(128);

        let relay_max_circuits = env::var("RELAY_MAX_CIRCUITS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(64);

        let enable_dcutr = env::var("SOLNET_DCUTR")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(true);

        Self {
            solana_rpc_url: env::var("SOLANA_RPC_URL")
                .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string()),
            http_port: std::env::var("PORT")
                .or_else(|_| std::env::var("HTTP_PORT"))
                .unwrap_or_else(|_| "8080".to_string())
                .parse::<u16>()
                .unwrap_or(8080),
            p2p_port: env::var("P2P_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(9001),
            node_name: env::var("NODE_NAME").unwrap_or_else(|_| "sns-node-1".to_string()),
            log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
            shard_type,
            region,
            max_concurrent_requests: max_concurrent,
            rate_limit_per_min: rate_limit,
            node_wallet_pubkey: env::var("NODE_WALLET_PUBKEY").unwrap_or_default(),
            is_relay,
            relay_max_reservations,
            relay_max_circuits,
            enable_dcutr,
            bootstrap_nodes,
            env_mode: env::var("SOLNET_ENV").unwrap_or_else(|_| "production".to_string()),
            whitelist_ip: env::var("SOLNET_WHITELIST_IP").unwrap_or_default(),
            telemetry_url: env::var("SOLNET_TELEMETRY_URL")
                .unwrap_or_else(|_| "https://solnet-production.up.railway.app/telemetry/ingest".to_string()),
        }
    }
}
