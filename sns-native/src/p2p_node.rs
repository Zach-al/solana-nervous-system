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
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;
use std::sync::OnceLock;
use tracing::{error, info, warn, debug};

// Railway bootstrap — WSS only (Railway terminates TLS, raw TCP is not reachable)
const BOOTSTRAP_ADDR: &str = "/dns4/solnet-production.up.railway.app/tcp/443/wss/p2p/12D3KooWAH253rSpr8ryATyS45AXq7whPN1giEv6A7pufF5fmmNj";

#[derive(NetworkBehaviour)]
pub struct MobileNodeBehaviour {
    pub kademlia: kad::Behaviour<MemoryStore>,
    pub identify: identify::Behaviour,
    pub autonat: autonat::Behaviour,
    pub relay_client: relay::client::Behaviour,
    pub dcutr: libp2p::swarm::behaviour::toggle::Toggle<dcutr::Behaviour>,
    #[cfg(feature = "mdns")]
    pub mdns: libp2p::swarm::behaviour::toggle::Toggle<libp2p::mdns::tokio::Behaviour>,
    pub ping: ping::Behaviour,
    pub connection_limits: ConnectionLimitsBehaviour,
}

static P2P_RUNNING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
static PEER_COUNT: AtomicUsize = AtomicUsize::new(0);
static SWARM_TX: OnceLock<tokio::sync::mpsc::Sender<P2PCommand>> = OnceLock::new();

enum P2PCommand {
    Dial(Multiaddr),
}

pub fn init_node(enable_mdns: bool) -> Result<String, String> {
    if P2P_RUNNING.load(Ordering::SeqCst) {
        return Ok("already_running".to_string());
    }

    let rt = crate::relay_client::get_runtime().ok_or("Relay runtime not initialized. Start relay first.")?;
    let (tx, mut rx) = tokio::sync::mpsc::channel(32);
    let _ = SWARM_TX.set(tx);

    let local_key = libp2p::identity::Keypair::generate_ed25519();
    let local_peer_id = PeerId::from(local_key.public());
    let peer_id_str = local_peer_id.to_string();

    rt.spawn(async move {
        info!("Starting mobile P2P node...");

        let result = async {
            // THE ORDER MATTERS: TCP -> QUIC -> DNS -> WS -> RELAY
            let mut swarm = SwarmBuilder::with_existing_identity(local_key)
                .with_tokio()
                .with_tcp(tcp::Config::default(), noise::Config::new, yamux::Config::default)?
                .with_quic() // usually no '?' for quic in latest libp2p if features are correct
                .with_dns()?
                .with_websocket(noise::Config::new, yamux::Config::default).await?
                .with_relay_client(noise::Config::new, yamux::Config::default)?
                .with_behaviour(move |key: &libp2p::identity::Keypair, relay_client: libp2p::relay::client::Behaviour| {
                    let peer_id = key.public().to_peer_id();
                    let kademlia = kad::Behaviour::new(peer_id, MemoryStore::new(peer_id));
                    let identify = identify::Behaviour::new(identify::Config::new("/solnet-mobile/1.0.0".into(), key.public()));
                    let autonat = autonat::Behaviour::new(peer_id, autonat::Config::default());
                    let dcutr = libp2p::swarm::behaviour::toggle::Toggle::from(Some(dcutr::Behaviour::new(peer_id)));
                    let ping = ping::Behaviour::new(ping::Config::new().with_interval(Duration::from_secs(30)));
                    let connection_limits = ConnectionLimitsBehaviour::new(
                        ConnectionLimits::default()
                            .with_max_established_incoming(Some(10))
                            .with_max_established_outgoing(Some(40))
                    );

                    #[cfg(feature = "mdns")]
                    let mdns = if enable_mdns {
                        let m = libp2p::mdns::tokio::Behaviour::new(libp2p::mdns::Config::default(), peer_id)?;
                        Some(m)
                    } else {
                        None
                    };

                    Ok::<MobileNodeBehaviour, Box<dyn std::error::Error + Send + Sync>>(MobileNodeBehaviour {
                        kademlia, identify, autonat, relay_client, dcutr,
                        #[cfg(feature = "mdns")]
                        mdns: libp2p::swarm::behaviour::toggle::Toggle::from(mdns),
                        ping, connection_limits,
                    })
                })?
                .build();

            // Listen on all interfaces
            let _ = swarm.listen_on("/ip4/0.0.0.0/tcp/0".parse().unwrap());
            let _ = swarm.listen_on("/ip4/0.0.0.0/udp/0/quic-v1".parse().unwrap());

            // Bootstrap
            let bootstrap_addr: Multiaddr = BOOTSTRAP_ADDR.parse().unwrap();
            let _ = swarm.dial(bootstrap_addr.clone());
            if let Some(libp2p::core::multiaddr::Protocol::P2p(peer_id)) = bootstrap_addr.iter().last() {
                swarm.behaviour_mut().kademlia.add_address(&peer_id, bootstrap_addr);
            }
            let _ = swarm.behaviour_mut().kademlia.bootstrap();

            P2P_RUNNING.store(true, Ordering::SeqCst);
            info!("Mobile P2P node ACTIVE");

            loop {
                tokio::select! {
                    command = rx.recv() => {
                        match command {
                            Some(P2PCommand::Dial(addr)) => {
                                let _ = swarm.dial(addr);
                            }
                            None => break,
                        }
                    }
                    event = swarm.select_next_some() => {
                        match event {
                            SwarmEvent::ConnectionEstablished { peer_id, .. } => {
                                PEER_COUNT.fetch_add(1, Ordering::SeqCst);
                                info!("✅ P2P connected: {}", peer_id);
                            }
                            SwarmEvent::ConnectionClosed { peer_id, .. } => {
                                PEER_COUNT.fetch_sub(1, Ordering::SeqCst);
                                info!("❌ P2P disconnected: {}", peer_id);
                            }
                            SwarmEvent::Behaviour(MobileNodeBehaviourEvent::Identify(identify::Event::Received { peer_id, info, .. })) => {
                                for addr in info.listen_addrs {
                                    swarm.behaviour_mut().kademlia.add_address(&peer_id, addr);
                                }
                            }
                            #[cfg(feature = "mdns")]
                            SwarmEvent::Behaviour(MobileNodeBehaviourEvent::Mdns(libp2p::mdns::Event::Discovered(list))) => {
                                for (peer_id, addr) in list {
                                    swarm.behaviour_mut().kademlia.add_address(&peer_id, addr);
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
            Ok::<(), Box<dyn std::error::Error + Send + Sync>>(())
        }.await;

        if let Err(e) = result {
            error!("P2P Node error: {}", e);
        }
        P2P_RUNNING.store(false, Ordering::SeqCst);
    });

    Ok(peer_id_str)
}

pub fn dial_peer(multiaddr: &str) -> bool {
    if let (Some(tx), Ok(addr)) = (SWARM_TX.get(), multiaddr.parse::<Multiaddr>()) {
        tx.try_send(P2PCommand::Dial(addr)).is_ok()
    } else {
        false
    }
}

pub fn get_peer_count() -> usize {
    PEER_COUNT.load(Ordering::SeqCst)
}
