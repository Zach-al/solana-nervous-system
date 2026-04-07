use crate::config::Config;
use anyhow::Result;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
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
}


#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    node_id: String,
    requests_served: u64,
    earnings_lamports: u64,
    uptime_seconds: u64,
}

pub async fn start_rpc_proxy(config: Config, node_id: String) -> Result<()> {
    let stats = Arc::new(Mutex::new(NodeStats {
        node_id: node_id.clone(),
        node_name: config.node_name.clone(),
        requests_served: 0,
        earnings_lamports: 0,
        started_at: Utc::now(),
        peer_count: 0,
    }));

    let state = SharedState {
        stats,
        solana_rpc_url: config.solana_rpc_url.clone(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", post(rpc_handler))
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

async fn rpc_handler(
    State(state): State<SharedState>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    // Parse and validate the request has a "method" field
    let body_str = match std::str::from_utf8(&body) {
        Ok(s) => s,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "jsonrpc": "2.0",
                    "error": { "code": -32700, "message": "Parse error: invalid UTF-8" },
                    "id": null
                })),
            )
                .into_response()
        }
    };

    let rpc_req: serde_json::Value = match serde_json::from_str(body_str) {
        Ok(v) => v,
        Err(e) => {
            warn!("Invalid JSON received: {}", e);
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "jsonrpc": "2.0",
                    "error": { "code": -32700, "message": "Parse error" },
                    "id": null
                })),
            )
                .into_response();
        }
    };

    let method = match rpc_req.get("method").and_then(|m| m.as_str()) {
        Some(m) => m.to_string(),
        None => {
            warn!("Request missing 'method' field");
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "jsonrpc": "2.0",
                    "error": { "code": -32600, "message": "Invalid Request: missing 'method'" },
                    "id": rpc_req.get("id")
                })),
            )
                .into_response();
        }
    };

    info!("Proxying RPC method: {}", method);

    // Forward to upstream Solana RPC
    let client = reqwest::Client::new();
    let rpc_url = state.solana_rpc_url.clone();

    let mut req_builder = client
        .post(&rpc_url)
        .header("Content-Type", "application/json")
        .body(body_str.to_string());

    // Forward content-type if present
    if let Some(ct) = headers.get("content-type") {
        if let Ok(ct_str) = ct.to_str() {
            req_builder = req_builder.header("Content-Type", ct_str);
        }
    }

    match req_builder.send().await {
        Ok(resp) => {
            let _status = resp.status();
            let response_bytes = match resp.bytes().await {
                Ok(b) => b,
                Err(e) => {
                    error!("Failed to read upstream response: {}", e);
                    return (
                        StatusCode::BAD_GATEWAY,
                        Json(serde_json::json!({
                            "jsonrpc": "2.0",
                            "error": { "code": -32603, "message": "Upstream read error" },
                            "id": null
                        })),
                    )
                        .into_response();
                }
            };

            // Update stats on success
            {
                let mut stats = state.stats.lock().await;
                stats.requests_served += 1;
                stats.earnings_lamports += 100;
            }

            let response_json: serde_json::Value =
                serde_json::from_slice(&response_bytes).unwrap_or_else(|_| {
                    serde_json::json!({ "error": "invalid upstream response" })
                });

            (StatusCode::OK, Json(response_json)).into_response()
        }
        Err(e) => {
            error!("Failed to forward RPC request to {}: {}", rpc_url, e);
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({
                    "jsonrpc": "2.0",
                    "error": { "code": -32603, "message": format!("Upstream error: {}", e) },
                    "id": null
                })),
            )
                .into_response()
        }
    }
}

async fn health_handler(State(state): State<SharedState>) -> impl IntoResponse {
    let stats = state.stats.lock().await;
    let uptime = (Utc::now() - stats.started_at).num_seconds() as u64;

    Json(HealthResponse {
        status: "ok",
        node_id: stats.node_id.clone(),
        requests_served: stats.requests_served,
        earnings_lamports: stats.earnings_lamports,
        uptime_seconds: uptime,
    })
}

async fn stats_handler(State(state): State<SharedState>) -> impl IntoResponse {
    let stats = state.stats.lock().await;
    let uptime = (Utc::now() - stats.started_at).num_seconds() as u64;

    Json(serde_json::json!({
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
}
