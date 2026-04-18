/// Mesh sharding — each node specializes in a traffic type
/// Routing is deterministic based on method classification
use std::collections::HashMap;
use serde;

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum ShardType {
    DeFi,
    NFT,
    General,
}

pub struct ShardRouter {
    pub shard_type: ShardType,
    method_map: HashMap<&'static str, ShardType>,
}

impl ShardRouter {
    pub fn new(shard_type: ShardType) -> Self {
        let mut method_map = HashMap::new();

        for method in &[
            "sendTransaction",
            "simulateTransaction",
            "getLatestBlockhash",
            "getFeeForMessage",
            "getRecentPrioritizationFees",
            "getTokenAccountBalance",
            "getTokenAccountsByOwner",
        ] {
            method_map.insert(*method, ShardType::DeFi);
        }

        for method in &[
            "getAccountInfo",
            "getMultipleAccounts",
            "getProgramAccounts",
            "getTokenLargestAccounts",
            "getTokenSupply",
        ] {
            method_map.insert(*method, ShardType::NFT);
        }

        Self { shard_type, method_map }
    }

    pub fn should_handle(&self, method: &str) -> bool {
        match self.method_map.get(method) {
            Some(required_shard) => required_shard == &self.shard_type,
            None => self.shard_type == ShardType::General,
        }
    }

    pub fn get_shard_for_method(&self, method: &str) -> ShardType {
        self.method_map.get(method).cloned().unwrap_or(ShardType::General)
    }

    pub fn select_peer_for_shard(shard: &ShardType, peers: &[String]) -> Option<String> {
        if peers.is_empty() {
            return None;
        }
        let shard_index = match shard {
            ShardType::DeFi => 0,
            ShardType::NFT => 1,
            ShardType::General => 2,
        };
        let peer_index = shard_index % peers.len();
        Some(peers[peer_index].clone())
    }
}
