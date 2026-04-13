use crate::verifier::{MerkleVerifier, RpcProof};
use serde_json::Value;

#[allow(dead_code)]
pub struct LightClient;

#[allow(dead_code)]
impl LightClient {
    /// Takes an RPC response and its attached RpcProof and independently verifies the hash integrity.
    /// Returns true if the proof matches the payload perfectly.
    pub fn verify_node_response(response: &Value, proof: &RpcProof) -> Result<bool, String> {
        let is_valid = MerkleVerifier::verify_proof(response, proof);
        if is_valid {
            Ok(true)
        } else {
            Err("Cryptographic verification failed: Proof does not match response data.".to_string())
        }
    }
}
