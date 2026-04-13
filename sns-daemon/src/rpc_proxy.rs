use crate::config::Config;
use crate::security::{CircuitBreaker, InputSanitizer, RateLimiter};
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
use tracing::{error, info, warn};

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
    pub rate_limiter: Arc<RateLimiter>,
    pub circuit_breaker: Arc<CircuitBreaker>,
    pub slot_cache: crate::SlotCache,
    pub zk_batch: Arc<Mutex<crate::zk_payments::ZkReceiptBatch>>,
    pub onion_router: Arc<OnionRouter>,
    pub peer_registry: Arc<DashMap<String, String>>,
    pub daily_salt: Arc<DailySalt>,
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
) -> Result<()> {
    let stats = Arc::new(Mutex::new(NodeStats {
        node_id: node_id.clone(),
        node_name: config.node_name.clone(),
        requests_served: 0,
        earnings_lamports: 0,
        started_at: Utc::now(),
        peer_count: 0,
    }));

    let rate_limiter = Arc::new(RateLimiter::new());
    let circuit_breaker = Arc::new(CircuitBreaker::new());

    // Background task: clean up stale rate-limiter entries every 5 minutes
    {
        let rl = rate_limiter.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(300)).await;
                rl.cleanup();
            }
        });
    }

    let state = SharedState {
        stats,
        solana_rpc_url: config.solana_rpc_url.clone(),
        rate_limiter,
        circuit_breaker,
        slot_cache,
        zk_batch,
        onion_router,
        peer_registry,
        daily_salt,
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

    // ── 1. Extract client IP ──────────────────────────────────
    let client_ip = extract_ip(&headers);

    // ── 2. Rate limiting — 100 req/min per IP ────────────────
    if !state.rate_limiter.check(&client_ip) {
        warn!("Rate limit exceeded for IP: {}", client_ip);
        let mut resp = (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32029,
                    "message": "Rate limit exceeded. Max 100 requests per minute."
                },
                "id": null
            })),
        )
            .into_response();
        resp.headers_mut().extend(sec_headers);
        resp.headers_mut().insert(
            "Retry-After",
            HeaderValue::from_static("60"),
        );
        return resp;
    }

    // ── 3. Parse JSON body ───────────────────────────────────
    let body_str = match std::str::from_utf8(&body) {
        Ok(s) => s,
        Err(_) => {
            let mut resp = (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "jsonrpc": "2.0",
                    "error": { "code": -32700, "message": "Parse error: invalid UTF-8" },
                    "id": null
                })),
            )
                .into_response();
            resp.headers_mut().extend(sec_headers);
            return resp;
        }
    };

    let rpc_req: serde_json::Value = match serde_json::from_str(body_str) {
        Ok(v) => v,
        Err(e) => {
            warn!("Invalid JSON from {}: {}", client_ip, e);
            let mut resp = (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "jsonrpc": "2.0",
                    "error": { "code": -32700, "message": "Parse error" },
                    "id": null
                })),
            )
                .into_response();
            resp.headers_mut().extend(sec_headers);
            return resp;
        }
    };

    // ── 4. Input sanitization (whitelist + depth check) ──────
    if let Err(reason) = InputSanitizer::validate(&rpc_req) {
        warn!("Input validation failed from {}: {}", client_ip, reason);
        let mut resp = (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "jsonrpc": "2.0",
                "error": { "code": -32600, "message": format!("Invalid request: {}", reason) },
                "id": rpc_req.get("id")
            })),
        )
            .into_response();
        resp.headers_mut().extend(sec_headers);
        return resp;
    }

    let method = rpc_req
        .get("method")
        .and_then(|m| m.as_str())
        .unwrap_or("unknown");
    info!("Proxying RPC method: {} from {}", method, client_ip);

    // ── INTERCEPT getSlot ────────────────────────────────────
    if method == "getSlot" {
        let slot = state.slot_cache.current_slot.load(std::sync::atomic::Ordering::Relaxed);
        let mut response_json = serde_json::json!({
            "jsonrpc": "2.0",
            "result": slot,
            "id": rpc_req.get("id")
        });

        // Generate and inject V0.2 Cryptographic Verify Proof
        let (_, proof) = crate::verifier::MerkleVerifier::generate_proof(&response_json);
        if let Some(obj) = response_json.as_object_mut() {
            obj.insert("solnet_proof".to_string(), serde_json::to_value(proof).unwrap());
        }

        // ADD RECEIPT FOR V0.3
        {
            let mut batch = state.zk_batch.lock().await;
            let salt = state.daily_salt.get_or_rotate();
            batch.add_receipt(crate::zk_payments::PaymentReceipt {
                client_ip_hash: hex::encode(sha2::Sha256::digest(format!("{}{}", client_ip, salt).as_bytes())),

                amount_lamports: 100, // Fixed cost for slot check
                method: "getSlot".to_string(),
                timestamp: chrono::Utc::now().timestamp() as u64,
                nonce: uuid::Uuid::new_v4().to_string(),
                node_signature: "TODO_SIGNATURE".to_string(),
            });
        }

        let mut r = (
            StatusCode::OK,
            Json(response_json),
        )
            .into_response();
        r.headers_mut().extend(sec_headers);
        return r;
    }

    // ── 5. Circuit breaker — fail fast if upstream is down ────
    if state.circuit_breaker.is_open() {
        warn!("Circuit breaker OPEN — refusing upstream request");
        let mut resp = (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32000,
                    "message": "Upstream Solana RPC is temporarily unavailable. Try again in 30s."
                },
                "id": rpc_req.get("id")
            })),
        )
            .into_response();
        resp.headers_mut().extend(sec_headers);
        resp.headers_mut().insert(
            "Retry-After",
            HeaderValue::from_static("30"),
        );
        return resp;
    }

    // ── 6. Forward to upstream Solana RPC ────────────────────
    let client = reqwest::Client::new();
    let rpc_url = state.solana_rpc_url.clone();

    match client
        .post(&rpc_url)
        .header("Content-Type", "application/json")
        .body(body_str.to_string())
        .send()
        .await
    {
        Ok(resp) => {
            match resp.bytes().await {
                Ok(response_bytes) => {
                    // ── 7. Success: record and return ─────────────────────
                    state.circuit_breaker.record_success();
                    {
                        let mut stats = state.stats.lock().await;
                        stats.requests_served += 1;
                        stats.earnings_lamports += 100;
                    }

                    // ADD RECEIPT FOR V0.3
                    {
                        let mut batch = state.zk_batch.lock().await;
                        let salt = state.daily_salt.get_or_rotate();
                        batch.add_receipt(crate::zk_payments::PaymentReceipt {
                            client_ip_hash: hex::encode(sha2::Sha256::digest(format!("{}{}", client_ip, salt).as_bytes())),

                            amount_lamports: 100,
                            method: method.to_string(),
                            timestamp: Utc::now().timestamp() as u64,
                            nonce: uuid::Uuid::new_v4().to_string(),
                            node_signature: "TODO_SIGNATURE".to_string(),
                        });
                    }

                    let mut response_json: serde_json::Value =
                        serde_json::from_slice(&response_bytes).unwrap_or_else(|_| {
                            serde_json::json!({ "error": "invalid upstream response" })
                        });

                    // Generate and inject V0.2 Cryptographic Verify Proof
                    let (_, proof) = crate::verifier::MerkleVerifier::generate_proof(&response_json);
                    if let Some(obj) = response_json.as_object_mut() {
                        obj.insert("solnet_proof".to_string(), serde_json::to_value(proof).unwrap());
                    }

                    let mut r = (StatusCode::OK, Json(response_json)).into_response();
                    r.headers_mut().extend(sec_headers);
                    r
                }
                Err(e) => {
                    // ── 8. Read failure ───────────────────────────────────
                    error!("Failed to read upstream response: {}", e);
                    state.circuit_breaker.record_failure();
                    let mut r = (
                        StatusCode::BAD_GATEWAY,
                        Json(serde_json::json!({
                            "jsonrpc": "2.0",
                            "error": { "code": -32603, "message": "Upstream read error" },
                            "id": null
                        })),
                    )
                        .into_response();
                    r.headers_mut().extend(sec_headers);
                    r
                }
            }
        }
        Err(e) => {
            // ── 8. Connection failure ─────────────────────────────────
            error!("Failed to forward RPC request to {}: {}", rpc_url, e);
            state.circuit_breaker.record_failure();
            let mut r = (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({
                    "jsonrpc": "2.0",
                    "error": { "code": -32603, "message": format!("Upstream error: {}", e) },
                    "id": null
                })),
            )
                .into_response();
            r.headers_mut().extend(sec_headers);
            r
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
    let wrapped = match base64::decode(&payload.layer) {
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
                    layer: base64::encode(&peeled.inner_payload),
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
