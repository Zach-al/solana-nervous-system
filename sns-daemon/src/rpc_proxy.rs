use crate::config::Config;
use crate::security::CircuitBreaker;
use sha2::Digest;
use anyhow::Result;
use axum::{
    extract::State,
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use dashmap::DashMap;
use crate::onion::OnionRouter;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, error, warn};
use serde_json;
use base64::{engine::general_purpose, Engine as _};
use std::sync::atomic::Ordering;

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct NodeStats {
    pub node_id: String,
    pub node_name: String,
    pub requests_served: u64,
    pub earnings_lamports: u64,
    pub started_at: DateTime<Utc>,
    pub peer_count: u64,
}

#[derive(Clone)]
pub struct SharedState {
    pub stats: Arc<Mutex<NodeStats>>,
    pub solana_rpc_url: String,
    pub circuit_breaker: Arc<CircuitBreaker>,
    pub slot_cache: crate::SlotCache,
    pub zk_batch: Arc<Mutex<crate::zk_payments::ZkReceiptBatch>>,
    pub onion_router: Arc<OnionRouter>,
    pub peer_registry: Arc<DashMap<String, String>>,
    pub daily_salt: Arc<DailySalt>,
    // V2.0 Enterprise Components
    pub shard_router: Arc<crate::sharding::ShardRouter>,
    pub parallel_executor: Arc<crate::parallel_executor::ParallelExecutor>,
    pub geo_router: Arc<crate::geo_router::GeoRouter>,
    pub load_balancer: Arc<crate::load_balancer::LoadBalancer>,
    pub attack_prevention: Arc<crate::attack_prevention::AttackPrevention>,
    pub config: Config,
}

pub struct DailySalt {
    salt: Arc<std::sync::Mutex<String>>,
    date: Arc<std::sync::Mutex<String>>,
}

impl DailySalt {
    pub fn new() -> Self {
        Self {
            salt: Arc::new(std::sync::Mutex::new(String::new())),
            date: Arc::new(std::sync::Mutex::new(String::new())),
        }
    }

    pub fn get_or_rotate(&self) -> String {
        let today = chrono::Utc::now()
            .format("%Y-%m-%d")
            .to_string();
        
        let mut date = self.date.lock().unwrap();
        let mut salt = self.salt.lock().unwrap();
        
        if *date != today {
            // Rotate — generate new random salt
            *salt = uuid::Uuid::new_v4()
                .to_string()
                .replace("-", "")
                + &uuid::Uuid::new_v4()
                .to_string()
                .replace("-", "");
            // 64 random hex chars
            *date = today;
        }
        
        salt.clone()
    }
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    node_id: String,
    requests_served: u64,
    earnings_lamports: u64,
    uptime_seconds: u64,
}

// ─────────────────────────────────────────────────────────────
// Server bootstrap
// ─────────────────────────────────────────────────────────────

pub async fn start_rpc_proxy(
    config: Config, 
    node_id: String, 
    slot_cache: crate::SlotCache,
    zk_batch: Arc<Mutex<crate::zk_payments::ZkReceiptBatch>>,
    onion_router: Arc<OnionRouter>,
    peer_registry: Arc<DashMap<String, String>>,
    daily_salt: Arc<DailySalt>,
    shard_router: Arc<crate::sharding::ShardRouter>,
    parallel_executor: Arc<crate::parallel_executor::ParallelExecutor>,
    geo_router: Arc<crate::geo_router::GeoRouter>,
    load_balancer: Arc<crate::load_balancer::LoadBalancer>,
    attack_prevention: Arc<crate::attack_prevention::AttackPrevention>,
) -> Result<()> {
    let stats = Arc::new(Mutex::new(NodeStats {
        node_id: node_id.clone(),
        node_name: config.node_name.clone(),
        requests_served: 0,
        earnings_lamports: 0,
        started_at: Utc::now(),
        peer_count: 0,
    }));

    let circuit_breaker = Arc::new(CircuitBreaker::new());

    let state = SharedState {
        stats,
        solana_rpc_url: config.solana_rpc_url.clone(),
        circuit_breaker,
        slot_cache,
        zk_batch,
        onion_router,
        peer_registry,
        daily_salt,
        shard_router,
        parallel_executor,
        geo_router,
        load_balancer,
        attack_prevention,
        config: config.clone(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", post(rpc_handler).get(root_get_handler))
        .route("/health", get(health_handler))
        .route("/stats", get(stats_handler))
        .route("/onion", post(onion_handler))
        .layer(cors)
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.http_port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("RPC proxy listening on http://{}", addr);

    axum::serve(listener, app).await?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────
// Security headers injected on every response
// ─────────────────────────────────────────────────────────────

fn security_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert("X-Content-Type-Options", HeaderValue::from_static("nosniff"));
    headers.insert("X-Frame-Options", HeaderValue::from_static("DENY"));
    headers.insert("X-XSS-Protection", HeaderValue::from_static("1; mode=block"));
    headers.insert("Referrer-Policy", HeaderValue::from_static("no-referrer"));
    headers.insert(
        "Content-Security-Policy",
        HeaderValue::from_static("default-src 'none'"),
    );
    headers.insert(
        "Strict-Transport-Security",
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    headers
}

// ─────────────────────────────────────────────────────────────
// Extract client IP from X-Forwarded-For or connection
// ─────────────────────────────────────────────────────────────

pub fn extract_ip(headers: &HeaderMap) -> String {

    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

// ─────────────────────────────────────────────────────────────
// RPC handler — security-hardened entry point
// ─────────────────────────────────────────────────────────────

async fn rpc_handler(
    State(state): State<SharedState>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let sec_headers = security_headers();
    let client_ip = extract_ip(&headers);

    // ── 1. Attack Prevention (Bans + Rate Limits) ───────────
    if state.attack_prevention.is_banned(&client_ip) {
        warn!("[V2.0 SECURITY] Blocked banned IP: {}", client_ip);
        return (StatusCode::FORBIDDEN, "IP Banned for abuse").into_response();
    }

    match state.attack_prevention.check_rate_limit(&client_ip) {
        crate::attack_prevention::RateResult::Banned => {
            warn!("[V2.0 SECURITY] IP {} banned for excessive requests", client_ip);
            return (StatusCode::FORBIDDEN, "IP Banned for abuse").into_response();
        }
        crate::attack_prevention::RateResult::Limited { retry_after } => {
            let mut resp = (StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded").into_response();
            resp.headers_mut().insert("Retry-After", HeaderValue::from(retry_after));
            return resp;
        }
        crate::attack_prevention::RateResult::Allowed => {}
    }

    // ── 2. Parse & Sanitize ─────────────────────────────────
    let body_str = match std::str::from_utf8(&body) {
        Ok(s) => s,
        Err(_) => return StatusCode::BAD_REQUEST.into_response(),
    };

    if let crate::attack_prevention::ScanResult::Blocked(reason) = 
        state.attack_prevention.scan_payload(body_str) 
    {
        warn!("[V2.0 SECURITY] Blocked malicious payload from {}: {}", client_ip, reason);
        return (StatusCode::BAD_REQUEST, format!("Malicious payload: {}", reason)).into_response();
    }

    let rpc_req: serde_json::Value = match serde_json::from_str(body_str) {
        Ok(v) => v,
        Err(_) => return StatusCode::BAD_REQUEST.into_response(),
    };

    let method = rpc_req.get("method").and_then(|m| m.as_str()).unwrap_or("unknown");

    // ── 3. Parallel Execution (Semaphore) ──────────────────
    // Extract account key if available (e.g., getAccountInfo)
    let account_key = rpc_req.get("params").and_then(|p| p.get(0)).and_then(|p| p.as_str());
    let _permit = match state.parallel_executor.acquire(method, account_key).await {
        Ok(p) => p,
        Err(_) => return StatusCode::SERVICE_UNAVAILABLE.into_response(),
    };

    // ── 4. Shard Routing (Mesh) ─────────────────────────────
    if !state.shard_router.should_handle(method) {
        let target_shard = state.shard_router.get_shard_for_method(method);
        info!("[V2.0 SHARDING] Redirecting {:?} method '{}' to shard mesh", target_shard, method);
        
        // Find node in Geo mesh
        if let Some(mesh_node) = state.geo_router.find_best_node(&state.config.region) {
            info!("[V2.0 MESH] Routing to {} in region {:?}", mesh_node.peer_id, mesh_node.region);
            
            // Forward via Load Balancer / Onion Layer V2 if needed
            // For now, proxy directly to mesh node endpoint with fallback
            let client = reqwest::Client::new();
            match client.post(&mesh_node.endpoint).body(body.clone()).send().await {
                Ok(resp) => {
                    let mut r = (StatusCode::from_u16(resp.status().as_u16()).unwrap(), resp.bytes().await.unwrap()).into_response();
                    r.headers_mut().extend(sec_headers);
                    return r;
                }
                Err(e) => {
                    warn!("[V2.0 MESH] Mesh node {} failed, falling back to local: {}", mesh_node.endpoint, e);
                    // FALLBACK TO LOCAL if mesh node is down (Nervous system must never go paralyzed)
                }
            }
        }
    }

    // ── 5. Process Request (Intercepts or Upstream) ─────────
    state.attack_prevention.increment_total();

    if method == "getSlot" {
        let slot = state.slot_cache.current_slot.load(Ordering::Relaxed);
        let mut response_json = serde_json::json!({
            "jsonrpc": "2.0",
            "result": slot,
            "id": rpc_req.get("id")
        });

        let (_, proof) = crate::verifier::MerkleVerifier::generate_proof(&response_json);
        if let Some(obj) = response_json.as_object_mut() {
            obj.insert("solnet_proof".to_string(), serde_json::to_value(proof).unwrap());
        }

        // Add receipt
        {
            let mut batch = state.zk_batch.lock().await;
            batch.add_receipt(crate::zk_payments::PaymentReceipt {
                client_ip_hash: hex::encode(sha2::Sha256::digest(format!("{}{}", client_ip, state.daily_salt.get_or_rotate()).as_bytes())),
                amount_lamports: 100,
                method: "getSlot".to_string(),
                timestamp: Utc::now().timestamp() as u64,
                nonce: uuid::Uuid::new_v4().to_string(),
                node_signature: "TODO_SIGNATURE".to_string(),
            });
        }

        let mut r = (StatusCode::OK, Json(response_json)).into_response();
        r.headers_mut().extend(sec_headers);
        return r;
    }

    // ── 6. Fail-over Upstream Load Balancer ─────────────────
    if state.circuit_breaker.is_open() {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    }

    let start_time = Utc::now();
    let upstream_rpc = state.load_balancer.select_node().await.unwrap_or_else(|| state.solana_rpc_url.clone());

    let client = reqwest::Client::new();
    match client.post(&upstream_rpc).header("Content-Type", "application/json").body(body_str.to_string()).send().await {
        Ok(resp) => {
            let latency = (Utc::now() - start_time).num_milliseconds() as u64;
            state.load_balancer.record_success(&upstream_rpc, latency).await;
            
            match resp.bytes().await {
                Ok(response_bytes) => {
                    state.circuit_breaker.record_success();
                    {
                        let mut stats = state.stats.lock().await;
                        stats.requests_served += 1;
                        stats.earnings_lamports += 100;
                    }

                    // Add Receipt
                    {
                        let mut batch = state.zk_batch.lock().await;
                        batch.add_receipt(crate::zk_payments::PaymentReceipt {
                            client_ip_hash: hex::encode(sha2::Sha256::digest(format!("{}{}", client_ip, state.daily_salt.get_or_rotate()).as_bytes())),
                            amount_lamports: 100,
                            method: method.to_string(),
                            timestamp: Utc::now().timestamp() as u64,
                            nonce: uuid::Uuid::new_v4().to_string(),
                            node_signature: "TODO_SIGNATURE".to_string(),
                        });
                    }

                    let mut response_json: serde_json::Value = serde_json::from_slice(&response_bytes).unwrap();
                    let (_, proof) = crate::verifier::MerkleVerifier::generate_proof(&response_json);
                    if let Some(obj) = response_json.as_object_mut() {
                        obj.insert("solnet_proof".to_string(), serde_json::to_value(proof).unwrap());
                    }

                    let mut r = (StatusCode::OK, Json(response_json)).into_response();
                    r.headers_mut().extend(sec_headers);
                    r
                }
                Err(_) => StatusCode::BAD_GATEWAY.into_response()
            }
        }
        Err(_) => {
            state.load_balancer.record_error(&upstream_rpc).await;
            state.circuit_breaker.record_failure();
            StatusCode::BAD_GATEWAY.into_response()
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Onion handler — Privacy Layer V0.4
// ─────────────────────────────────────────────────────────────

#[derive(serde::Deserialize, serde::Serialize)]
struct OnionRequest {
    layer: String,    // base64 encoded layered payload
    next_hop: String, // peer ID (hex) or all zeros for exit
}

async fn onion_handler(
    State(state): State<SharedState>,
    Json(payload): Json<OnionRequest>,
) -> impl IntoResponse {
    let sec_headers = security_headers();
    
    // Decode layer
    let wrapped = match general_purpose::STANDARD.decode(&payload.layer) {
        Ok(b) => b,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":"invalid base64"}))).into_response(),
    };
    
    // Peel layer
    let peeled = match state.onion_router.peel_layer(&wrapped) {
        Ok(p) => p,
        Err(e) => {
            warn!("Onion peel failed: {}", e);
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error":format!("peel failed: {}", e)}))).into_response();
        }
    };
    
    if peeled.is_exit {
        info!("Peeling EXIT layer — processing RPC locally");
        
        // Re-construct headers for internal call
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", HeaderValue::from_static("anon-routed"));
        
        rpc_handler(
            State(state),
            headers,
            axum::body::Bytes::from(peeled.inner_payload),
        ).await.into_response()
    } else {
        info!("Peeling RELAY layer — forwarding to {}", peeled.next_hop);
        
        // Lookup next hop address - scope this to drop dashmap ref early
        let opt_addr = state.peer_registry.get(&peeled.next_hop).map(|v| v.value().clone());
        
        match opt_addr {
            Some(next_hop_addr) => {
                // Forward via HTTP to next hop
                let client = reqwest::Client::new();
                let forward_payload = OnionRequest {
                    layer: general_purpose::STANDARD.encode(&peeled.inner_payload),
                    next_hop: peeled.next_hop.clone(),
                };
                
                match client.post(&format!("{}/onion", next_hop_addr))
                    .json(&forward_payload)
                    .send()
                    .await 
                {
                    Ok(resp) => {
                        let status_code = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
                        let body = resp.bytes().await.unwrap_or_default();
                        let mut r = (status_code, body).into_response();
                        r.headers_mut().extend(sec_headers);
                        r
                    }
                    Err(e) => {
                        error!("Onion forward failed: {}", e);
                        (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error":format!("forward failed: {}", e)}))).into_response()
                    }
                }
            },
            None => {
                warn!("Peer {} not in registry, acting as exit node", peeled.next_hop);
                // Fallback to exit node behavior
                let mut headers = HeaderMap::new();
                headers.insert("x-forwarded-for", HeaderValue::from_static("anon-routed"));
                rpc_handler(
                    State(state),
                    headers,
                    axum::body::Bytes::from(peeled.inner_payload),
                ).await.into_response()
            }
        }
    }
}


// ─────────────────────────────────────────────────────────────
// Root GET endpoint (for browsers)
// ─────────────────────────────────────────────────────────────

async fn root_get_handler() -> impl IntoResponse {
    let mut r = (
        StatusCode::OK,
        "SOLNET JSON-RPC Gateway is active.\nSend POST requests with JSON-RPC payload.",
    )
        .into_response();
    r.headers_mut().extend(security_headers());
    r
}

// ─────────────────────────────────────────────────────────────
// Health endpoint
// ─────────────────────────────────────────────────────────────

async fn health_handler(State(state): State<SharedState>) -> impl IntoResponse {
    let stats = state.stats.lock().await;
    let uptime = (Utc::now() - stats.started_at).num_seconds() as u64;

    let mut r = Json(HealthResponse {
        status: "ok",
        node_id: stats.node_id.clone(),
        requests_served: stats.requests_served,
        earnings_lamports: stats.earnings_lamports,
        uptime_seconds: uptime,
    })
    .into_response();
    r.headers_mut().extend(security_headers());
    r
}

// ─────────────────────────────────────────────────────────────
// Stats endpoint
// ─────────────────────────────────────────────────────────────

async fn stats_handler(State(state): State<SharedState>) -> impl IntoResponse {
    let stats = state.stats.lock().await;
    let uptime = (Utc::now() - stats.started_at).num_seconds() as u64;

    let mut r = Json(serde_json::json!({
        "node_id": stats.node_id,
        "node_name": stats.node_name,
        "requests_served": stats.requests_served,
        "earnings_lamports": stats.earnings_lamports,
        "earnings_sol": stats.earnings_lamports as f64 / 1_000_000_000.0,
        "uptime_seconds": uptime,
        "started_at": stats.started_at,
        "peer_count": stats.peer_count,
        "rpc_url": state.solana_rpc_url,
        "status": "online"
    }))
    .into_response();
    r.headers_mut().extend(security_headers());
    r
}
