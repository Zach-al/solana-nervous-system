use sha2::{Sha256, Digest};
use serde::{Serialize, Deserialize};
use serde_json::{self, Value};


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcProof {
    pub root_hash: String,
    pub signature: Option<String>,
}

pub struct MerkleVerifier;

impl MerkleVerifier {
    // Takes raw RPC response, computes commitment hash
    // Returns (response, proof)
    pub fn generate_proof(response: &Value) -> (Value, RpcProof) {
        let serialized = serde_json::to_string(response).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(serialized.as_bytes());
        let root_hash = hex::encode(hasher.finalize());

        let proof = RpcProof {
            root_hash,
            signature: None,
        };

        (response.clone(), proof)
    }

#[allow(dead_code)]
    pub fn verify_proof(response: &Value, proof: &RpcProof) -> bool {
        let serialized = serde_json::to_string(response).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(serialized.as_bytes());
        let hash = hex::encode(hasher.finalize());
        hash == proof.root_hash
    }
}
