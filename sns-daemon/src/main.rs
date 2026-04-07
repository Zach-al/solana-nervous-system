mod config;
mod p2p;
mod rpc_proxy;
mod security;

use anyhow::Result;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[tokio::main]
async fn main() -> Result<()> {
    let cfg = config::Config::from_env();

    // Initialize tracing subscriber with env-filter
    tracing_subscriber::registry()
        .with(fmt::layer().with_target(false))
        .with(EnvFilter::new(&cfg.log_level))
        .init();

    print_banner(&cfg);

    let cfg_clone = cfg.clone();
    let cfg_clone2 = cfg.clone();

    // Spawn HTTP RPC proxy and P2P node concurrently
    let rpc_handle = tokio::spawn(async move {
        let node_id = uuid::Uuid::new_v4().to_string();
        if let Err(e) = rpc_proxy::start_rpc_proxy(cfg_clone, node_id).await {
            tracing::error!("RPC proxy error: {}", e);
        }
    });

    let p2p_handle = tokio::spawn(async move {
        if let Err(e) = p2p::start_p2p_node(cfg_clone2).await {
            tracing::error!("P2P node error: {}", e);
        }
    });

    // Wait for both tasks
    tokio::try_join!(rpc_handle, p2p_handle)?;

    Ok(())
}

fn print_banner(cfg: &config::Config) {
    println!(
        r#"
╔══════════════════════════════════════════════════════════╗
║        🧠  SOLANA NERVOUS SYSTEM (SNS) DAEMON           ║
║             Decentralized RPC Mesh Network               ║
╠══════════════════════════════════════════════════════════╣
║  NODE NAME : {:<43}║
║  RPC PROXY : http://0.0.0.0:{:<29}║
║  P2P MESH  : /ip4/0.0.0.0/tcp/{:<27}║
║  SOLANA    : {:<43}║
╚══════════════════════════════════════════════════════════╝
"#,
        cfg.node_name,
        cfg.http_port,
        cfg.p2p_port,
        cfg.solana_rpc_url
    );
}
