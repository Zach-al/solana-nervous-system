use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub solana_rpc_url: String,
    pub http_port: u16,
    pub p2p_port: u16,
    pub node_name: String,
    pub log_level: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            solana_rpc_url: env::var("SOLANA_RPC_URL")
                .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string()),
            http_port: env::var("HTTP_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(9000),
            p2p_port: env::var("P2P_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(9001),
            node_name: env::var("NODE_NAME").unwrap_or_else(|_| "sns-node-1".to_string()),
            log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
        }
    }
}
