use crate::config::Config;
use anyhow::Result;
use libp2p::{
    futures::StreamExt,
    kad::{self, store::MemoryStore},
    noise, tcp, yamux,
    swarm::{SwarmEvent, NetworkBehaviour},
    SwarmBuilder,
};
use tracing::{info, warn};
use std::sync::Arc;
use dashmap::DashMap;

#[derive(NetworkBehaviour)]
struct SnsNodeBehaviour {
    kademlia: kad::Behaviour<MemoryStore>,
}

#[allow(dead_code)]
pub fn get_peer_id(config: &Config) -> String {
    // Generate a deterministic placeholder — real peer ID comes from swarm keypair
    format!("sns-{}", config.node_name)
}

pub async fn start_p2p_node(
    config: Config,
    peer_registry: Arc<DashMap<String, String>>,
) -> Result<()> {
    let mut swarm = SwarmBuilder::with_new_identity()
        .with_tokio()
        .with_tcp(
            tcp::Config::default(),
            (noise::Config::new, noise::Config::new),
            yamux::Config::default,
        )?
        .with_behaviour(|key| {
            let peer_id = key.public().to_peer_id();
            info!("🔑 Local Peer ID: {}", peer_id);

            let store = MemoryStore::new(peer_id);
            let kademlia = kad::Behaviour::new(peer_id, store);

            Ok(SnsNodeBehaviour { kademlia })
        })?
        .build();

    // Listen on the configured P2P port
    let listen_addr: libp2p::Multiaddr = format!("/ip4/0.0.0.0/tcp/{}", config.p2p_port)
        .parse()
        .expect("valid multiaddr");

    swarm.listen_on(listen_addr)?;

    info!("🕸️  P2P mesh node starting on port {}", config.p2p_port);

    // Drive the swarm event loop
    loop {
        match swarm.next().await {
            Some(SwarmEvent::NewListenAddr { address, .. }) => {
                info!("📡 Listening on: {}", address);
            }
            Some(SwarmEvent::ConnectionEstablished { peer_id, endpoint, .. }) => {
                info!("✅ Peer connected: {}", peer_id);
                let addr = endpoint.get_remote_address().to_string();
                if let Some(ip) = extract_ip_from_multiaddr(&addr) {
                    peer_registry.insert(
                        peer_id.to_string(),
                        format!("http://{}:{}", ip, 9000) // Defaulting to 9000 for demo
                    );
                    info!("📍 Registered {} at {}", peer_id, ip);
                }
            }
            Some(SwarmEvent::ConnectionClosed { peer_id, cause, .. }) => {
                match cause {
                    Some(err) => info!("❌ Peer disconnected: {} (reason: {})", peer_id, err),
                    None => info!("❌ Peer disconnected: {}", peer_id),
                }
            }
            Some(SwarmEvent::Behaviour(SnsNodeBehaviourEvent::Kademlia(event))) => {
                info!("🗺️  Kademlia routing event: {:?}", event);
            }
            Some(SwarmEvent::IncomingConnection { local_addr, send_back_addr, .. }) => {
                info!("🔗 Incoming connection from {} on {}", send_back_addr, local_addr);
            }
            Some(SwarmEvent::OutgoingConnectionError { peer_id, error, .. }) => {
                warn!("⚠️  Outgoing connection error to {:?}: {}", peer_id, error);
            }
            Some(_) => {}
            None => break,
        }
    }

    Ok(())
}

fn extract_ip_from_multiaddr(addr: &str) -> Option<String> {
    // Basic parser for /ip4/x.x.x.x/...
    if addr.contains("/ip4/") {
        let parts: Vec<&str> = addr.split("/ip4/").collect();
        if parts.len() > 1 {
            let ip_part = parts[1].split('/').next()?;
            return Some(ip_part.to_string());
        }
    }
    None
}

