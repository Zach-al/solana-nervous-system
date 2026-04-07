use crate::config::Config;
use crate::security::{CircuitBreaker, InputSanitizer, RateLimiter};
use anyhow::Result;
use axum::{
    extract::State,
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
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

pub async fn start_rpc_proxy(config: Config, node_id: String) -> Result<()> {
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
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", post(rpc_handler).get(root_get_handler))
        .route("/health", get(health_handler))
        .route("/stats", get(stats_handler))
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

fn extract_ip(headers: &HeaderMap) -> String {
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

                    let response_json: serde_json::Value =
                        serde_json::from_slice(&response_bytes).unwrap_or_else(|_| {
                            serde_json::json!({ "error": "invalid upstream response" })
                        });

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
