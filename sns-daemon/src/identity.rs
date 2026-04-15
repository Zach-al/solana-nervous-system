use libp2p::identity::{Keypair, ed25519};
use std::path::Path;
use base64::{Engine as _, engine::general_purpose};

pub struct NodeIdentity;

impl NodeIdentity {
    /// Load existing keypair or generate new one
    /// Saves to disk so Peer ID is stable across restarts
    /// On Railway: uses /app/data/node_keypair if writable
    /// Falls back to env var SOLNET_NODE_KEY (base64)
    /// Falls back to generating new (not recommended for relay)
    pub fn load_or_generate() -> Keypair {
        // Priority 1: Environment variable (best for Railway)
        if let Ok(key_b64) = std::env::var("SOLNET_NODE_KEY") {
            if let Ok(mut bytes) = general_purpose::STANDARD.decode(&key_b64) {
                if let Ok(secret) = 
                    ed25519::SecretKey::try_from_bytes(&mut bytes) 
                {
                    let keypair = ed25519::Keypair::from(secret);
                    tracing::info!(
                        "Loaded stable identity from \
                         SOLNET_NODE_KEY env var"
                    );
                    return Keypair::from(keypair);
                }
            }
            tracing::warn!(
                "SOLNET_NODE_KEY set but invalid, \
                 generating new identity"
            );
        }

        // Priority 2: File on disk
        let key_path = std::env::var("SOLNET_KEY_PATH")
            .unwrap_or_else(|_| "./node_keypair.bin".into());

        if Path::new(&key_path).exists() {
            if let Ok(mut bytes) = std::fs::read(&key_path) {
                if let Ok(secret) = 
                    ed25519::SecretKey::try_from_bytes(&mut bytes)
                {
                    let keypair = ed25519::Keypair::from(secret);
                    tracing::info!(
                        "Loaded stable identity from {}",
                        key_path
                    );
                    return Keypair::from(keypair);
                }
            }
        }

        // Priority 3: Generate new and save
        tracing::warn!(
            "No stable identity found. Generating new keypair."
        );
        tracing::warn!(
            "Set SOLNET_NODE_KEY env var to make \
             Peer ID stable across restarts."
        );

        let secret = ed25519::SecretKey::generate();
        let bytes = secret.as_ref().to_vec();

        // Try to save to disk
        if let Err(e) = std::fs::write(&key_path, &bytes) {
            tracing::warn!(
                "Could not save keypair to {}: {}",
                key_path, e
            );
        }

        // Print the base64 so operator can save it
        let b64 = general_purpose::STANDARD.encode(&bytes);
        tracing::info!(
            "Generated new Peer ID. To make it permanent:"
        );
        tracing::info!(
            "Set Railway env: SOLNET_NODE_KEY={}", b64
        );

        Keypair::from(ed25519::Keypair::from(secret))
    }
}
