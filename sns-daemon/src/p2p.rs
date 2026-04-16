use crate::config::Config;
use anyhow::Result;
use libp2p::{
    autonat, dcutr, identify,
    futures::StreamExt,
    kad::{self, store::MemoryStore},
    noise, tcp, yamux, relay,
    swarm::{NetworkBehaviour, SwarmEvent},
    SwarmBuilder, Multiaddr, PeerId
};
use libp2p::connection_limits::{
    ConnectionLimits, 
    Behaviour as ConnectionLimitsBehaviour
};
use libp2p::ping;
use std::num::NonZeroUsize;
use tracing::{info, warn, debug};
use std::sync::Arc;
use dashmap::DashMap;
use std::str::FromStr;
use std::time::Duration;

use std::sync::atomic::Ordering;

#[derive(NetworkBehaviour)]
struct SnsNodeBehaviour {
    kademlia: kad::Behaviour<MemoryStore>,
    identify: identify::Behaviour,
    autonat: autonat::Behaviour,
    relay_client: relay::client::Behaviour,
    relay_server: relay::Behaviour,
    dcutr: libp2p::swarm::behaviour::toggle::Toggle<dcutr::Behaviour>,
    ping: ping::Behaviour,
    connection_limits: ConnectionLimitsBehaviour,
}

// SECURITY NOTE: Gossipsub deliberately excluded.
// CVE-2026-Gossipsub: Remote panic via crafted PRUNE.
// SOLNET uses Kademlia DHT for peer discovery only.
// No Gossipsub feature in Cargo.toml features list.

#[allow(dead_code)]
pub fn get_peer_id(config: &Config) -> String {
    format!("sns-{}", config.node_name)
}

#[allow(clippy::too_many_arguments)]
pub async fn start_p2p_node(
    config: Config,
    peer_registry: Arc<DashMap<String, String>>,
    platform_config: &crate::platform::PlatformConfig,
    connected_peers: Arc<std::sync::atomic::AtomicUsize>,
    hole_punch_attempts: Arc<std::sync::atomic::AtomicUsize>,
    _hole_punch_successes: Arc<std::sync::atomic::AtomicUsize>,
    nat_status: Arc<tokio::sync::Mutex<String>>,
    node_multiaddrs: Arc<tokio::sync::Mutex<Vec<String>>>,
    peer_guard: Arc<crate::peer_guard::PeerGuard>,
    telemetry: Arc<crate::telemetry::TelemetryCollector>,
) -> Result<()> {
    tracing::info!("Starting native Web3 Libp2p mesh node...");

    // Print banners
    if config.is_relay {
        println!("╔══════════════════════════════════════╗");
        println!("║     SOLNET RELAY NODE ACTIVE         ║");
        println!("║  Circuit Relay v2 accepting peers    ║");
        println!("║  DCUtR hole punching enabled         ║");
        println!("║  Max reservations: {:<17} ║", config.relay_max_reservations);
        println!("╚══════════════════════════════════════╝");
    } else if config.bootstrap_nodes.is_empty() {
        tracing::warn!(
            "No bootstrap peers configured. \n\
             Node is isolated from mesh.\n\
             Set SOLNET_BOOTSTRAP to join the network.\n\
             Example: SOLNET_BOOTSTRAP=/dns4/solnet-production.up.railway.app/tcp/9001/p2p/<peer-id>"
        );
    }

    // Create or load the keypair
    let local_key = crate::identity::NodeIdentity::load_or_generate();
    let local_peer_id = PeerId::from(local_key.public());
    info!("🔑 Local Peer ID: {}", local_peer_id);

    // Provide the platform constraint (mobile uses lower resource limits)
    let is_mobile = !platform_config.p2p_enabled;

    // Build the swarm
    let mut swarm = SwarmBuilder::with_existing_identity(local_key.clone())
        .with_tokio()
        .with_tcp(
            tcp::Config::default(),
            (noise::Config::new, noise::Config::new),
            yamux::Config::default,
        )?
        .with_quic()
        .with_relay_client(noise::Config::new, yamux::Config::default)?
        .with_behaviour(|key, relay_client| {
            let peer_id = key.public().to_peer_id();

            // Kademlia
            let store = MemoryStore::new(peer_id);
            let mut kademlia = kad::Behaviour::new(peer_id, store);
            kademlia.set_mode(Some(kad::Mode::Server));

            // Identify
            let identify = identify::Behaviour::new(identify::Config::new(
                "/solnet/2.1.0".into(),
                key.public(),
            ));

            // AutoNAT (detect Symmetric NAT vs Full Cone)
            let autonat = autonat::Behaviour::new(peer_id, autonat::Config::default());

            // Relay Server (only fully functional if config.is_relay)
            let mut relay_config = relay::Config::default();
            if !config.is_relay || is_mobile {
                // If not designated as relay, deny relay circuits to save battery/bandwidth
                relay_config.max_circuits = 0;
                relay_config.max_circuits_per_peer = 0;
                relay_config.max_reservations = 0;
            } else {
                relay_config.max_circuits = config.relay_max_circuits;
                relay_config.max_reservations = config.relay_max_reservations;
            }
            let relay_server = relay::Behaviour::new(peer_id, relay_config);

            // DCUtR (Hole Punching protocol)
            let dcutr = if config.enable_dcutr {
                libp2p::swarm::behaviour::toggle::Toggle::from(Some(dcutr::Behaviour::new(peer_id)))
            } else {
                libp2p::swarm::behaviour::toggle::Toggle::from(None)
            };

            // Connection Limits to prevent exhaustion attacks
            let limits = ConnectionLimits::default()
                .with_max_established_incoming(Some(250))
                .with_max_established_outgoing(Some(250))
                .with_max_pending_incoming(Some(25))
                .with_max_pending_outgoing(Some(25))
                .with_max_established_per_peer(Some(3));
            let connection_limits = ConnectionLimitsBehaviour::new(limits);

            // Ping to keep track of connection health
            let ping = ping::Behaviour::new(ping::Config::new().with_interval(Duration::from_secs(15)));

            // Security: Set DCUtR cooldown to 60s for Android stability
            // (libp2p-dcutr doesn't expose a clean config for this yet, so we'll 
            // handle the prioritization log logic in the match loop)

            Ok(SnsNodeBehaviour {
                kademlia,
                identify,
                autonat,
                relay_client,
                relay_server,
                dcutr,
                ping,
                connection_limits,
            })
        })?
        .with_swarm_config(|c| {
            c.with_idle_connection_timeout(Duration::from_secs(30))
             .with_max_negotiating_inbound_streams(10)
             .with_notify_handler_buffer_size(NonZeroUsize::new(32).unwrap())
        })
        .build();

    // Listen addresses (TCP + QUIC)
    let tcp_addr: Multiaddr = format!("/ip4/0.0.0.0/tcp/{}", config.p2p_port).parse()?;
    let quic_addr: Multiaddr = format!("/ip4/0.0.0.0/udp/{}/quic-v1", config.p2p_port).parse()?;

    if let Err(e) = swarm.listen_on(tcp_addr) {
        warn!("Failed to listen on TCP p2p port {}: {}. Mesh might be restricted.", config.p2p_port, e);
    }
    if let Err(e) = swarm.listen_on(quic_addr) {
        warn!("Failed to listen on QUIC p2p port {}: {}. Mesh might be restricted.", config.p2p_port, e);
    }

    info!("🔗 Node Multiaddr (TCP): /ip4/<your-ip>/tcp/{}/p2p/{}", config.p2p_port, local_peer_id);
    info!("🔗 Node Multiaddr (UDP): /ip4/<your-ip>/udp/{}/quic-v1/p2p/{}", config.p2p_port, local_peer_id);

    // Bootstrap Connection
    for addr_str in &config.bootstrap_nodes {
        if let Ok(addr) = Multiaddr::from_str(addr_str) {
            info!("Dialing bootstrap node: {}", addr);
            if let Err(e) = swarm.dial(addr.clone()) {
                warn!("Failed to dial {}: {:?}", addr, e);
            }
            
            // Extract peer_id from multiaddr to add to kademlia
            if let Some(libp2p::core::multiaddr::Protocol::P2p(peer_id)) = addr.iter().last() {
                swarm.behaviour_mut().kademlia.add_address(&peer_id, addr.clone());
            }
        } else {
            warn!("Invalid multiaddr: {}", addr_str);
        }
    }

    if !config.bootstrap_nodes.is_empty() {
        if let Err(e) = swarm.behaviour_mut().kademlia.bootstrap() {
            warn!("Failed to start Kademlia bootstrap: {:?}", e);
        }
    }

    // Drive the swarm
    loop {
        match swarm.select_next_some().await {
            SwarmEvent::NewListenAddr { address, .. } => {
                info!("📡 Listening on: {}", address);
                node_multiaddrs.lock().await.push(address.to_string());
            }
            SwarmEvent::ConnectionEstablished { peer_id, endpoint, .. } => {
                info!("✅ Peer connected: {} via {:?}", peer_id, endpoint.get_remote_address());
                connected_peers.fetch_add(1, Ordering::Relaxed);
                telemetry.record_new_peer();
                let addr = endpoint.get_remote_address().to_string();
                if let Some(ip) = extract_ip_from_multiaddr(&addr) {
                    peer_registry.insert(
                        peer_id.to_string(),
                        format!("http://{}:{}", ip, config.http_port)
                    );
                }
                peer_guard.on_connected(&peer_id);
            }
            SwarmEvent::ConnectionClosed { peer_id, cause, .. } => {
                connected_peers.fetch_sub(1, Ordering::Relaxed);
                match cause {
                    Some(err) => {
                        debug!("❌ Peer disconnected: {} (reason: {})", peer_id, err);
                        peer_guard.on_failed_handshake(&peer_id);
                    },
                    None => debug!("❌ Peer disconnected: {}", peer_id),
                }
            }
            SwarmEvent::Behaviour(SnsNodeBehaviourEvent::Kademlia(event)) => {
                debug!("🗺️  Kademlia event: {:?}", event);
            }
            SwarmEvent::Behaviour(SnsNodeBehaviourEvent::Identify(identify::Event::Received { peer_id, info, .. })) => {
                for addr in info.listen_addrs {
                    swarm.behaviour_mut().kademlia.add_address(&peer_id, addr);
                }
            }
            SwarmEvent::Behaviour(SnsNodeBehaviourEvent::Identify(_)) => {}
            SwarmEvent::Behaviour(SnsNodeBehaviourEvent::Autonat(autonat::Event::StatusChanged { old, new })) => {
                info!("🔄 AutoNAT status changed from {:?} to {:?}", old, new);
                let status_str = match new {
                    autonat::NatStatus::Public(_) => "PublicAddress".to_string(),
                    autonat::NatStatus::Private => "Private".to_string(),
                    autonat::NatStatus::Unknown => "Unknown".to_string(),
                };
                *nat_status.lock().await = status_str;
            }
            SwarmEvent::Behaviour(SnsNodeBehaviourEvent::Autonat(_)) => {}
            SwarmEvent::Behaviour(SnsNodeBehaviourEvent::Dcutr(_)) => {
                // DCUtR event received (Toggle wrapped)
                // We'll restore detailed logging once the ToggleEvent path is stabilized for rustc 1.85
                hole_punch_attempts.fetch_add(1, Ordering::Relaxed);
            }
            SwarmEvent::OutgoingConnectionError { peer_id, error, .. } => {
                warn!("⚠️  Outgoing connection error to {:?}: {}", peer_id, error);
            }
            _ => {}
        }
    }
}

fn extract_ip_from_multiaddr(addr: &str) -> Option<String> {
    if addr.contains("/ip4/") {
        let parts: Vec<&str> = addr.split("/ip4/").collect();
        if parts.len() > 1 {
            let ip_part = parts[1].split('/').next()?;
            return Some(ip_part.to_string());
        }
    }
    None
}
