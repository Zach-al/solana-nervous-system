/// Geographic edge routing — route requests to nearest node by latency
use dashmap::DashMap;
use std::sync::Arc;
use serde;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GeoNode {
    pub peer_id: String,
    pub endpoint: String,
    pub region: Region,
    pub latency_ms: u64,
    pub load_percent: u8,
    pub alive: bool,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum Region {
    AsiaSouth,
    AsiaEast,
    EuropeWest,
    USEast,
    USWest,
    SouthAmerica,
    Africa,
    MiddleEast,
}

impl Region {
    pub fn from_env_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "asia-east" => Region::AsiaEast,
            "europe-west" => Region::EuropeWest,
            "us-east" => Region::USEast,
            "us-west" => Region::USWest,
            "south-america" => Region::SouthAmerica,
            "africa" => Region::Africa,
            "middle-east" => Region::MiddleEast,
            _ => Region::AsiaSouth,
        }
    }

    pub fn nearest_regions(&self) -> Vec<Region> {
        match self {
            Region::AsiaSouth => vec![Region::AsiaEast, Region::MiddleEast, Region::EuropeWest],
            Region::AsiaEast => vec![Region::AsiaSouth, Region::USWest, Region::EuropeWest],
            Region::EuropeWest => vec![Region::USEast, Region::MiddleEast, Region::AsiaSouth],
            Region::USEast => vec![Region::EuropeWest, Region::USWest, Region::SouthAmerica],
            Region::USWest => vec![Region::AsiaEast, Region::USEast, Region::AsiaSouth],
            Region::SouthAmerica => vec![Region::USEast, Region::EuropeWest, Region::Africa],
            Region::Africa => vec![Region::EuropeWest, Region::MiddleEast, Region::SouthAmerica],
            Region::MiddleEast => vec![Region::EuropeWest, Region::AsiaSouth, Region::Africa],
        }
    }
}

pub struct GeoRouter {
    nodes: Arc<DashMap<String, GeoNode>>,
    pub local_region: Region,
}

impl GeoRouter {
    pub fn new(local_region: Region) -> Self {
        Self {
            nodes: Arc::new(DashMap::new()),
            local_region,
        }
    }

    pub fn register_node(&self, node: GeoNode) {
        self.nodes.insert(node.peer_id.clone(), node);
    }

    pub fn find_best_node(&self, client_region: &Region) -> Option<GeoNode> {
        // Same region first
        let same: Vec<GeoNode> = self
            .nodes
            .iter()
            .filter(|n| &n.region == client_region && n.alive && n.load_percent < 80)
            .map(|n| n.clone())
            .collect();

        if let Some(best) = same.iter().min_by_key(|n| n.latency_ms) {
            return Some(best.clone());
        }

        // Adjacent regions
        for adjacent in client_region.nearest_regions() {
            let adj_nodes: Vec<GeoNode> = self
                .nodes
                .iter()
                .filter(|n| n.region == adjacent && n.alive && n.load_percent < 90)
                .map(|n| n.clone())
                .collect();

            if let Some(best) = adj_nodes.iter().min_by_key(|n| n.latency_ms) {
                return Some(best.clone());
            }
        }

        // Any alive node
        self.nodes
            .iter()
            .filter(|n| n.alive)
            .min_by_key(|n| n.latency_ms)
            .map(|n| n.clone())
    }

    pub fn update_node_health(
        &self,
        peer_id: &str,
        latency_ms: u64,
        load_percent: u8,
        alive: bool,
    ) {
        if let Some(mut node) = self.nodes.get_mut(peer_id) {
            node.latency_ms = latency_ms;
            node.load_percent = load_percent;
            node.alive = alive;
        }
    }
}
