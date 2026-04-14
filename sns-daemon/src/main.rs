pub mod config;
pub mod p2p;
pub mod rpc_proxy;
pub mod security;
pub mod verifier;
pub mod light_client;
pub mod zk_payments;
pub mod onion;
pub mod sharding;
pub mod parallel_executor;
pub mod geo_router;
pub mod load_balancer;
pub mod attack_prevention;
pub mod wallet_rewards;
pub mod latency_engine;

use anyhow::Result;
use serde_json;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[derive(Clone)]
pub struct SlotCache {
    pub current_slot: Arc<AtomicU64>,
}

use tokio::sync::Mutex;

impl SlotCache {
    pub fn new() -> Self {
        Self {
            current_slot: Arc::new(AtomicU64::new(0)),
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let cfg = config::Config::from_env();

    // Initialize tracing subscriber with env-filter
    tracing_subscriber::registry()
        .with(fmt::layer().with_target(false))
        .with(EnvFilter::new(&cfg.log_level))
        .init();
    
    tracing::info!("Starting SOLNET V2.1 Enterprise Release...");

    let cfg_clone = cfg.clone();
    let cfg_clone2 = cfg.clone();

    // Instantiate SlotCache
    let slot_cache = SlotCache::new();
    let cache_clone = slot_cache.clone();
    let rpc_url = cfg.solana_rpc_url.clone();

    // Initialize ZkReceiptBatch
    let zk_batch = Arc::new(Mutex::new(zk_payments::ZkReceiptBatch::new()));
    let zk_batch_clone = zk_batch.clone();
    let zk_batch_clone2 = zk_batch.clone();
    
    // Initialize V2.0 components
    let onion_router = Arc::new(onion::OnionRouter::new());
    let shard_router = Arc::new(sharding::ShardRouter::new(cfg.shard_type.clone()));
    let parallel_executor = Arc::new(parallel_executor::ParallelExecutor::new(cfg.max_concurrent_requests));
    let geo_router = Arc::new(geo_router::GeoRouter::new(cfg.region.clone()));
    let load_balancer = Arc::new(load_balancer::LoadBalancer::new(load_balancer::Strategy::Adaptive));
    let attack_prevention = Arc::new(attack_prevention::AttackPrevention::new());
    
    // Initialize V2.1 components
    let wallet_tracker = if cfg.node_wallet_pubkey.is_empty() {
        tracing::warn!("NODE_WALLET_PUBKEY not set. Earnings tracked in memory only.");
        None
    } else {
        Some(Arc::new(wallet_rewards::WalletRewardTracker::new(
            &cfg.node_wallet_pubkey,
            cfg.solana_rpc_url.clone(),
        )?))
    };
    
    let latency_engine = Arc::new(latency_engine::LatencyEngine::new(cfg.max_concurrent_requests));

    // Register local node in geo router
    geo_router.register_node(geo_router::GeoNode {
        peer_id: "local".to_string(), // Will be updated by p2p
        endpoint: format!("http://0.0.0.0:{}", cfg.http_port),
        region: cfg.region.clone(),
        latency_ms: 0,
        load_percent: 0,
        alive: true,
    });

    // Add default upstream to load balancer
    load_balancer.add_node(cfg.solana_rpc_url.clone(), 100).await;

    print_banner(&cfg, &onion_router, &shard_router, &geo_router);

    let peer_registry = Arc::new(dashmap::DashMap::new());
    let daily_salt = Arc::new(rpc_proxy::DailySalt::new());
    
    let onion_router_clone = onion_router.clone();
    let peer_registry_clone = peer_registry.clone();
    let daily_salt_clone = daily_salt.clone();
    let peer_registry_clone2 = peer_registry.clone();

    // Spawn security cleanup task
    let ap_cleanup = attack_prevention.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            ap_cleanup.cleanup();
        }
    });

    // Spawn cache eviction task (V2.1)
    let le_cleanup = latency_engine.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            le_cleanup.evict_expired();
        }
    });

    // Spawn hourly settlement task
    tokio::spawn(async move {
        loop {
            // Run every hour (3600s)
            tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
            
            let mut batch_lock = zk_batch_clone.lock().await;
            match batch_lock.persist_and_clear("./batches").await {
                Ok(compressed) => {
                    tracing::info!(
                        "Settled batch {}: {} receipts, {} lamports", 
                        compressed.batch_id, 
                        compressed.receipt_count, 
                        compressed.total_lamports
                    );
                }
                Err(e) => {
                    tracing::error!("Failed to persist batch: {}", e);
                }
            }
        }
    });

    // Spawn background task to update slot every 2 seconds
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        loop {
            match client
                .post(&rpc_url)
                .json(&serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getSlot",
                    "params": []
                }))
                .send()
                .await
            {
                Ok(resp) => {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(slot) = json["result"].as_u64() {
                            cache_clone.current_slot.store(slot, Ordering::Relaxed);
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to fetch current slot: {}", e);
                }
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        }
    });

    // Spawn HTTP RPC proxy and P2P node concurrently
    let rpc_handle = tokio::spawn(async move {
        let node_id = uuid::Uuid::new_v4().to_string();
        if let Err(e) = rpc_proxy::start_rpc_proxy(
            cfg_clone, 
            node_id, 
            slot_cache, 
            zk_batch_clone2,
            onion_router_clone,
            peer_registry_clone,
            daily_salt_clone,
            shard_router,
            parallel_executor,
            geo_router,
            load_balancer,
            attack_prevention,
            wallet_tracker,
            latency_engine,
        ).await {
            tracing::error!("RPC proxy error: {}", e);
        }
    });

    let p2p_handle = tokio::spawn(async move {
        if let Err(e) = p2p::start_p2p_node(cfg_clone2, peer_registry_clone2).await {
            tracing::error!("P2P node error: {}", e);
        }
    });

    // Wait for both tasks
    tokio::try_join!(rpc_handle, p2p_handle)?;

    Ok(())
}

fn print_banner(
    cfg: &config::Config, 
    onion_router: &onion::OnionRouter,
    shard_router: &sharding::ShardRouter,
    geo_router: &geo_router::GeoRouter,
) {
    println!(
        r#"
╔══════════════════════════════════════════════════════════╗
║        🧠  SOLANA NERVOUS SYSTEM (SNS) DAEMON           ║
║             Enterprise Release V2.1                      ║
╠══════════════════════════════════════════════════════════╣
║  NODE NAME : {:<43}║
║  RPC PROXY : http://0.0.0.0:{:<29}║
║  P2P MESH  : /ip4/0.0.0.0/tcp/{:<27}║
║  SHARD     : {:<43?}║
║  REGION    : {:<43?}║
║  WALLET    : {:<43}║
║  ONION KEY : {:<43}║
╚══════════════════════════════════════════════════════════╝
"#,
        cfg.node_name,
        cfg.http_port,
        cfg.p2p_port,
        shard_router.shard_type,
        geo_router.local_region,
        if cfg.node_wallet_pubkey.is_empty() { "NOT CONFIGURED".to_string() } else { cfg.node_wallet_pubkey.clone() },
        hex::encode(onion_router.public_key.as_bytes())
    );
}
