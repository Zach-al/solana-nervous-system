/// Mobile nodes cannot run DHT (battery/data cost)
/// Instead they register with bootstrap nodes via HTTP
/// Bootstrap assigns them to nearest desktop node
/// Mobile node then routes all requests through
/// that assigned desktop node

use std::time::Duration;

const BOOTSTRAP_NODES: &[&str] = &[
    "https://solnet-production.up.railway.app",
];

pub struct MobilePeerClient {
    assigned_peer: Option<String>,
    client: reqwest::Client,
    node_id: String,
    platform_name: String,
}

impl MobilePeerClient {
    pub fn new(node_id: String, platform_name: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .tcp_nodelay(true)
            .build()
            .expect("Failed to build mobile client");

        Self {
            assigned_peer: None,
            client,
            node_id,
            platform_name,
        }
    }

    /// Register with bootstrap and get assigned peer
    pub async fn register(&mut self) -> Result<String, anyhow::Error> {
        for bootstrap in BOOTSTRAP_NODES {
            let resp = self.client
                .post(format!("{}/mobile/register", bootstrap))
                .json(&serde_json::json!({
                    "node_id": self.node_id,
                    "platform": self.platform_name,
                    "version": env!("CARGO_PKG_VERSION"),
                    "capabilities": ["rpc-proxy"],
                }))
                .send()
                .await;

            match resp {
                Ok(r) if r.status().is_success() => {
                    let data: serde_json::Value = r.json().await?;
                    let peer = data["assigned_peer"]
                        .as_str()
                        .unwrap_or(bootstrap)
                        .to_string();

                    self.assigned_peer = Some(peer.clone());
                    tracing::info!("Mobile node registered → peer: {}", peer);
                    return Ok(peer);
                }
                _ => {
                    tracing::warn!(
                        "Bootstrap {} unreachable, trying next",
                        bootstrap
                    );
                }
            }
        }

        // Fallback: use first bootstrap as direct peer
        let fallback = BOOTSTRAP_NODES[0].to_string();
        self.assigned_peer = Some(fallback.clone());
        Ok(fallback)
    }

    /// Forward RPC request through assigned desktop peer
    pub async fn forward_request(
        &self,
        payload: serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let peer = self.assigned_peer
            .as_deref()
            .unwrap_or(BOOTSTRAP_NODES[0]);

        let resp = self.client
            .post(peer)
            .json(&payload)
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        Ok(resp)
    }

    pub fn get_assigned_peer(&self) -> Option<&str> {
        self.assigned_peer.as_deref()
    }
}
