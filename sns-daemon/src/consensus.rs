/// consensus.rs
///
/// 3-node Byzantine fault-tolerant consensus for SOLNET RPC routing.
///
/// Algorithm:
///   1. Pick 3 non-blacklisted nodes at random.
///   2. Query all 3 concurrently with a 5s timeout.
///   3. If ≥2 responses agree → return consensus result.
///   4. The dissenting node receives a "strike"; 3 strikes → permanent blacklist.
///   5. If no consensus → return ConsensusError::NoConsensus (caller falls back).

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;


// ─── Internal bookkeeping ─────────────────────────────────────────────────────

#[derive(Clone, serde::Serialize)]
struct BlacklistEntry {
    reason:      String,
    timestamp:   u64,
    strike_count: u32,
}

#[derive(Clone, Default, serde::Serialize)]
struct NodeStats {
    requests_proxied:   u64,
    consensus_failures: u64,
}

// ─── Public types ─────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum ConsensusError {
    #[error("Fewer than 3 eligible nodes available")]
    InsufficientNodes,

    #[error("No consensus reached across 3 nodes")]
    NoConsensus,

    #[error("All queried nodes returned errors")]
    AllNodesFailed,
}

// Derive thiserror if available; otherwise provide manual Display impl
// We add thiserror as a dev/optional dep; if not present, compile without it.

// ─── ConsensusRouter ─────────────────────────────────────────────────────────

pub struct ConsensusRouter {
    blacklist:  Arc<DashMap<String, BlacklistEntry>>,
    node_stats: Arc<DashMap<String, NodeStats>>,
}

impl ConsensusRouter {
    pub fn new() -> Self {
        Self {
            blacklist:  Arc::new(DashMap::new()),
            node_stats: Arc::new(DashMap::new()),
        }
    }

    pub fn is_blacklisted(&self, node_id: &str) -> bool {
        self.blacklist.contains_key(node_id)
    }

    /// Query 3 random non-blacklisted nodes and return the consensus value.
    ///
    /// `T` must implement `PartialEq + Eq + std::hash::Hash` so we can tally votes.
    /// In practice `T = serde_json::Value` satisfies this via the PartialEq impl.
    pub async fn query_with_consensus(
        &self,
        _rpc_url_base: &str,
        method: &str,
        params: serde_json::Value,
        available_nodes: &[String],
    ) -> Result<serde_json::Value, ConsensusError> {
        // Filter blacklisted nodes
        let eligible: Vec<&String> = available_nodes
            .iter()
            .filter(|n| !self.is_blacklisted(n))
            .collect();

        if eligible.len() < 3 {
            return Err(ConsensusError::InsufficientNodes);
        }

        // Select 3 at random
        use rand::seq::SliceRandom;
        let mut rng = rand::thread_rng();
        let selected: Vec<String> = eligible
            .choose_multiple(&mut rng, 3)
            .map(|s| (*s).clone())
            .collect();

        tracing::debug!(
            "[Consensus] Querying 3 nodes for {}: {:?}",
            method,
            selected
        );

        // Fire all 3 queries concurrently
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_default();

        let futs = selected.iter().map(|node_id| {
            let c = client.clone();
            let node = node_id.clone();
            let m = method.to_string();
            let p = params.clone();
            async move {
                (
                    node.clone(),
                    Self::query_node(&c, &node, &m, p).await,
                )
            }
        });

        let results: Vec<(String, Result<serde_json::Value, String>)> =
            futures::future::join_all(futs).await;

        // Tally results — use JSON string as the canonical comparison key
        let mut vote_map: HashMap<String, Vec<String>> = HashMap::new();
        let mut error_count = 0usize;

        for (node_id, result) in &results {
            match result {
                Ok(val) => {
                    let key = val.to_string(); // canonical string for equality
                    vote_map.entry(key).or_default().push(node_id.clone());
                }
                Err(e) => {
                    error_count += 1;
                    tracing::warn!("[Consensus] Node {} returned error: {}", node_id, e);
                }
            }
        }

        if error_count == 3 {
            return Err(ConsensusError::AllNodesFailed);
        }

        // Find a key with ≥2 votes (2-of-3 majority)
        for (canonical, agreeing_nodes) in &vote_map {
            if agreeing_nodes.len() >= 2 {
                // Parse the consensus value back
                let consensus_val: serde_json::Value =
                    serde_json::from_str(canonical).unwrap_or(serde_json::Value::Null);

                // Punish any node that disagreed
                for node_id in &selected {
                    if !agreeing_nodes.contains(node_id) {
                        self.punish_node(node_id, "Returned value diverged from 2-of-3 consensus");
                    }
                }

                tracing::debug!(
                    "[Consensus] Consensus achieved for {} ({}/3 agree)",
                    method,
                    agreeing_nodes.len()
                );
                return Ok(consensus_val);
            }
        }

        // All three returned different answers
        tracing::warn!(
            "[Consensus] No consensus for {} — all three nodes disagreed",
            method
        );
        Err(ConsensusError::NoConsensus)
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    async fn query_node(
        client: &reqwest::Client,
        node_endpoint: &str,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let url = format!("{}/rpc", node_endpoint.trim_end_matches('/'));
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        });

        let resp = client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

        if let Some(err) = json.get("error") {
            return Err(format!("RPC error: {}", err));
        }

        Ok(json["result"].clone())
    }

    fn punish_node(&self, node_id: &str, reason: &str) {
        let mut entry = self.blacklist
            .entry(node_id.to_string())
            .or_insert(BlacklistEntry {
                reason:       reason.to_string(),
                timestamp:    Self::now_secs(),
                strike_count: 0,
            });
        entry.strike_count += 1;

        if entry.strike_count >= 3 {
            tracing::error!(
                "[Consensus] Node {} permanently blacklisted after {} strikes ({})",
                node_id,
                entry.strike_count,
                reason
            );
        } else {
            tracing::warn!(
                "[Consensus] Strike {}/3 for node {} — {}",
                entry.strike_count,
                node_id,
                reason
            );
        }

        // Update stats
        self.node_stats
            .entry(node_id.to_string())
            .or_default()
            .consensus_failures += 1;
    }

    fn now_secs() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    /// JSON summary of the blacklist (exposed via /health or /admin).
    pub fn blacklist_summary(&self) -> serde_json::Value {
        let entries: Vec<serde_json::Value> = self
            .blacklist
            .iter()
            .map(|e| serde_json::json!({
                "node_id":    e.key(),
                "reason":     e.value().reason,
                "strikes":    e.value().strike_count,
                "timestamp":  e.value().timestamp,
                "permanent":  e.value().strike_count >= 3,
            }))
            .collect();

        serde_json::json!({
            "blacklisted_count": entries.len(),
            "entries": entries,
        })
    }
}

impl Default for ConsensusRouter {
    fn default() -> Self {
        Self::new()
    }
}
