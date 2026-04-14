/// Dynamic load balancer with multiple strategies

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use serde_json;

#[derive(Debug, Clone)]
pub struct LoadBalancerNode {
    pub endpoint: String,
    pub weight: u32,
    pub current_connections: Arc<AtomicUsize>,
    pub total_requests: Arc<AtomicUsize>,
    pub error_count: Arc<AtomicUsize>,
    pub avg_latency_ms: Arc<AtomicUsize>,
    pub alive: bool,
}

#[allow(dead_code)]
pub enum Strategy {
    RoundRobin,
    LeastConnections,
    WeightedRoundRobin,
    LatencyBased,
    Adaptive,
}

pub struct LoadBalancer {
    nodes: Arc<RwLock<Vec<LoadBalancerNode>>>,
    strategy: Strategy,
    round_robin_counter: Arc<AtomicUsize>,
}

impl LoadBalancer {
    pub fn new(strategy: Strategy) -> Self {
        Self {
            nodes: Arc::new(RwLock::new(Vec::new())),
            strategy,
            round_robin_counter: Arc::new(AtomicUsize::new(0)),
        }
    }

    pub async fn add_node(&self, endpoint: String, weight: u32) {
        let mut nodes = self.nodes.write().await;
        nodes.push(LoadBalancerNode {
            endpoint,
            weight,
            current_connections: Arc::new(AtomicUsize::new(0)),
            total_requests: Arc::new(AtomicUsize::new(0)),
            error_count: Arc::new(AtomicUsize::new(0)),
            avg_latency_ms: Arc::new(AtomicUsize::new(0)),
            alive: true,
        });
    }

    pub async fn select_node(&self) -> Option<String> {
        let nodes = self.nodes.read().await;
        let alive: Vec<&LoadBalancerNode> = nodes.iter().filter(|n| n.alive).collect();

        if alive.is_empty() {
            return None;
        }

        match self.strategy {
            Strategy::RoundRobin => {
                let idx = self.round_robin_counter.fetch_add(1, Ordering::Relaxed) % alive.len();
                Some(alive[idx].endpoint.clone())
            }
            Strategy::LeastConnections => alive
                .iter()
                .min_by_key(|n| n.current_connections.load(Ordering::Relaxed))
                .map(|n| n.endpoint.clone()),
            Strategy::LatencyBased => alive
                .iter()
                .min_by_key(|n| n.avg_latency_ms.load(Ordering::Relaxed))
                .map(|n| n.endpoint.clone()),
            Strategy::WeightedRoundRobin => {
                let total_weight: u32 = alive.iter().map(|n| n.weight).sum();
                if total_weight == 0 {
                    return Some(alive[0].endpoint.clone());
                }
                let mut pick = (rand::random::<u32>() % total_weight) as i32;
                for node in &alive {
                    pick -= node.weight as i32;
                    if pick <= 0 {
                        return Some(node.endpoint.clone());
                    }
                }
                Some(alive[0].endpoint.clone())
            }
            Strategy::Adaptive => {
                let avg_connections: usize = alive
                    .iter()
                    .map(|n| n.current_connections.load(Ordering::Relaxed))
                    .sum::<usize>()
                    / alive.len().max(1);

                if avg_connections > 100 {
                    alive
                        .iter()
                        .min_by_key(|n| n.current_connections.load(Ordering::Relaxed))
                        .map(|n| n.endpoint.clone())
                } else {
                    alive
                        .iter()
                        .min_by_key(|n| n.avg_latency_ms.load(Ordering::Relaxed))
                        .map(|n| n.endpoint.clone())
                }
            }
        }
    }

    pub async fn record_success(&self, endpoint: &str, latency_ms: u64) {
        let nodes = self.nodes.read().await;
        if let Some(node) = nodes.iter().find(|n| n.endpoint == endpoint) {
            node.total_requests.fetch_add(1, Ordering::Relaxed);
            let current = node.avg_latency_ms.load(Ordering::Relaxed);
            let new_avg = (current * 9 + latency_ms as usize) / 10;
            node.avg_latency_ms.store(new_avg, Ordering::Relaxed);
        }
    }

    pub async fn record_error(&self, endpoint: &str) {
        let nodes = self.nodes.read().await;
        if let Some(node) = nodes.iter().find(|n| n.endpoint == endpoint) {
            let errors = node.error_count.fetch_add(1, Ordering::Relaxed);
            if errors > 10 {
                tracing::warn!("Node {} disabled after {} errors", endpoint, errors);
            }
        }
    }

    pub async fn get_metrics(&self) -> Vec<serde_json::Value> {
        let nodes = self.nodes.read().await;
        nodes
            .iter()
            .map(|n| {
                serde_json::json!({
                    "endpoint": n.endpoint,
                    "alive": n.alive,
                    "connections": n.current_connections.load(Ordering::Relaxed),
                    "total_requests": n.total_requests.load(Ordering::Relaxed),
                    "avg_latency_ms": n.avg_latency_ms.load(Ordering::Relaxed),
                    "error_count": n.error_count.load(Ordering::Relaxed),
                })
            })
            .collect()
    }
}
