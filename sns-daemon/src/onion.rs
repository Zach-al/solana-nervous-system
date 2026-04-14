use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use x25519_dalek::{EphemeralSecret, PublicKey, StaticSecret};
use rand::rngs::OsRng;
use anyhow::{Result, anyhow};

// Onion routing: request is encrypted in layers
// Each node peels one layer, forwards to next
// Exit node sees request but not origin
// No single node knows both origin AND destination

pub struct OnionRouter {
    private_key: StaticSecret,
    pub public_key: PublicKey,
}

impl OnionRouter {
    pub fn new() -> Self {
        let private_key = StaticSecret::random_from_rng(OsRng);
        let public_key = PublicKey::from(&private_key);
        Self { private_key, public_key }
    }

    // Client wraps request in 3 encryption layers
    // Layer 3 (outermost): encrypted for entry node
    // Layer 2 (middle): encrypted for relay node  
    // Layer 1 (innermost): encrypted for exit node
    pub fn wrap_request(
        payload: &[u8],
        node_keys: &[PublicKey], // [entry, relay, exit]
        next_hops: &[String],     // [relay_id, exit_id, "000..."]
    ) -> Result<Vec<u8>, anyhow::Error> {
        let mut wrapped = payload.to_vec();
        
        // Wrap innermost to outermost
        for (i, node_key) in node_keys.iter().enumerate().rev() {
            let next_hop = &next_hops[i];
            
            // Format: next_hop(64 chars hex = 32 bytes) + inner_payload
            let next_hop_bytes = hex::decode(next_hop)?;
            let mut layer_data = Vec::new();
            layer_data.extend_from_slice(&next_hop_bytes);
            layer_data.extend_from_slice(&wrapped);
            
            wrapped = Self::encrypt_layer(&layer_data, node_key)?;
        }
        
        Ok(wrapped)
    }

    // Node peels its own encryption layer
    // Gets next hop address + encrypted payload for next node
    pub fn peel_layer(
        &self,
        wrapped: &[u8],
    ) -> Result<PeeledLayer, anyhow::Error> {
        let decrypted = Self::decrypt_layer(
            wrapped, 
            &self.private_key
        )?;
        
        // First 32 bytes: next hop peer ID
        // Remaining bytes: payload for next hop
        if decrypted.len() < 32 {
            return Err(anyhow::anyhow!("invalid onion layer"));
        }
        
        let next_hop = hex::encode(&decrypted[..32]);
        let inner_payload = decrypted[32..].to_vec();
        
        Ok(PeeledLayer {
            next_hop: next_hop.clone(),
            inner_payload,
            is_exit: next_hop == "0".repeat(64),
        })
    }

    fn encrypt_layer(
        data: &[u8],
        recipient_key: &PublicKey,
    ) -> Result<Vec<u8>, anyhow::Error> {
        // Generate ephemeral keypair for this layer
        let ephemeral = EphemeralSecret::random_from_rng(OsRng);
        let ephemeral_pub = PublicKey::from(&ephemeral);
        
        // ECDH shared secret
        let shared = ephemeral.diffie_hellman(recipient_key);
        
        // AES-256-GCM encryption
        let key = Key::<Aes256Gcm>::from_slice(
            shared.as_bytes()
        );
        let cipher = Aes256Gcm::new(key);
        
        let mut nonce_bytes = [0u8; 12];
        rand::RngCore::fill_bytes(&mut OsRng, &mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let ciphertext = cipher
            .encrypt(nonce, data)
            .map_err(|e| anyhow::anyhow!("encrypt: {}", e))?;
        
        // Output: ephemeral_pub(32) + nonce(12) + ciphertext
        let mut output = Vec::new();
        output.extend_from_slice(ephemeral_pub.as_bytes());
        output.extend_from_slice(&nonce_bytes);
        output.extend_from_slice(&ciphertext);
        
        Ok(output)
    }

    fn decrypt_layer(
        data: &[u8],
        our_key: &StaticSecret,
    ) -> Result<Vec<u8>, anyhow::Error> {
        if data.len() < 44 {
            return Err(anyhow::anyhow!("data too short"));
        }
        
        // Parse: ephemeral_pub(32) + nonce(12) + ciphertext
        let ephemeral_pub = PublicKey::from(
            <[u8; 32]>::try_from(&data[..32])?
        );
        let nonce = Nonce::from_slice(&data[32..44]);
        let ciphertext = &data[44..];
        
        // ECDH shared secret
        let shared = our_key.diffie_hellman(&ephemeral_pub);
        
        // Decrypt
        let key = Key::<Aes256Gcm>::from_slice(
            shared.as_bytes()
        );
        let cipher = Aes256Gcm::new(key);
        
        cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("decrypt: {}", e))
    }
}

pub struct PeeledLayer {
    pub next_hop: String,
    pub inner_payload: Vec<u8>,
    pub is_exit: bool,
}
