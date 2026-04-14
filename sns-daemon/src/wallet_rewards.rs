use std::sync::Arc;
use tokio::sync::Mutex;
use serde_json::json;
use crate::rpc_proxy::security_headers;

/// Real wallet reward tracker
/// Connects to actual Solana wallet via JSON-RPC
/// Tracks both pending (off-chain) and confirmed (on-chain)
pub struct WalletRewardTracker {
    /// Node operator's wallet public key (String to keep build light)
    pub node_wallet: String,
    /// Pending rewards not yet settled (lamports)
    pending_lamports: Arc<Mutex<u64>>,
    /// Confirmed on-chain balance cache
    confirmed_balance: Arc<Mutex<u64>>,
    /// Last time we fetched on-chain balance
    last_balance_fetch: Arc<Mutex<u64>>,
    /// RPC client for balance queries
    rpc_url: String,
    /// Total lifetime earnings (lamports)
    lifetime_earnings: Arc<Mutex<u64>>,
    /// Requests served this session
    session_requests: Arc<std::sync::atomic::AtomicU64>,
}

impl WalletRewardTracker {
    pub fn new(node_wallet_pubkey: &str, rpc_url: String) 
        -> Result<Self, anyhow::Error> 
    {
        // Simple validation: base58 check usually, but for hotfix we trust the env string
        if node_wallet_pubkey.len() < 32 || node_wallet_pubkey.len() > 44 {
            return Err(anyhow::anyhow!("Invalid wallet pubkey length"));
        }
            
        Ok(Self {
            node_wallet: node_wallet_pubkey.to_string(),
            pending_lamports: Arc::new(Mutex::new(0)),
            confirmed_balance: Arc::new(Mutex::new(0)),
            last_balance_fetch: Arc::new(Mutex::new(0)),
            rpc_url,
            lifetime_earnings: Arc::new(Mutex::new(0)),
            session_requests: Arc::new(
                std::sync::atomic::AtomicU64::new(0)
            ),
        })
    }
    
    /// Called after every successful RPC proxy
    /// Adds 100 lamports to pending rewards
    pub async fn record_request(&self) {
        self.session_requests
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let mut pending = self.pending_lamports.lock().await;
        *pending += 100; // 100 lamports per request
    }
    
    /// Get real on-chain wallet balance via native JSON-RPC
    /// Cached for 30 seconds to avoid spam
    pub async fn get_onchain_balance(&self) 
        -> Result<u64, anyhow::Error> 
    {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
            
        let mut last_fetch_guard = self.last_balance_fetch.lock().await;
        
        // Return cached if less than 30 seconds old
        if now - *last_fetch_guard < 30 {
            return Ok(*self.confirmed_balance.lock().await);
        }
        
        // Fetch real balance from Solana via reqwest (lightweight)
        let client = reqwest::Client::new();
        let payload = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBalance",
            "params": [self.node_wallet]
        });

        let resp = client.post(&self.rpc_url)
            .json(&payload)
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        let wallet_balance = resp["result"]["value"]
            .as_u64()
            .ok_or_else(|| anyhow::anyhow!("Invalid balance response from RPC"))?;
        
        *self.confirmed_balance.lock().await = wallet_balance;
        *last_fetch_guard = now;
        
        Ok(wallet_balance)
    }
    
    /// Full reward status for /stats endpoint
    pub async fn get_reward_status(&self) -> RewardStatus {
        let pending = *self.pending_lamports.lock().await;
        let confirmed = self.get_onchain_balance().await.unwrap_or_else(|_| {
            self.confirmed_balance.try_lock().map(|g| *g).unwrap_or(0)
        });
        let lifetime = *self.lifetime_earnings.lock().await;
        let requests = self.session_requests
            .load(std::sync::atomic::Ordering::Relaxed);
        
        RewardStatus {
            wallet_address: self.node_wallet.clone(),
            pending_lamports: pending,
            pending_sol: pending as f64 / 1_000_000_000.0,
            confirmed_wallet_balance_lamports: confirmed,
            confirmed_wallet_balance_sol: 
                confirmed as f64 / 1_000_000_000.0,
            lifetime_earned_lamports: lifetime,
            lifetime_earned_sol: 
                lifetime as f64 / 1_000_000_000.0,
            session_requests: requests,
            lamports_per_request: 100,
            next_settlement_in_secs: self
                .secs_until_next_settlement().await,
        }
    }
    
    async fn secs_until_next_settlement(&self) -> u64 {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        // Settlement every 3600 seconds (1 hour)
        3600 - (now % 3600)
    }
    
    /// Called after successful on-chain settlement
    pub async fn record_settlement(&self, amount: u64) {
        let mut pending = self.pending_lamports.lock().await;
        let mut lifetime = self.lifetime_earnings.lock().await;
        *lifetime += *pending;
        *pending = 0;
        tracing::info!(
            "Settlement recorded: {} lamports → wallet {}",
            amount,
            self.node_wallet
        );
    }
}

#[derive(serde::Serialize, Clone)]
pub struct RewardStatus {
    pub wallet_address: String,
    pub pending_lamports: u64,
    pub pending_sol: f64,
    pub confirmed_wallet_balance_lamports: u64,
    pub confirmed_wallet_balance_sol: f64,
    pub lifetime_earned_lamports: u64,
    pub lifetime_earned_sol: f64,
    pub session_requests: u64,
    pub lamports_per_request: u64,
    pub next_settlement_in_secs: u64,
}
