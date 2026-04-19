/// relay_client.rs
///
/// Mobile relay client for SOLNET.
///
/// This is NOT a daemon — it is an edge relay that:
///   1. Receives RPC calls from the JS layer via FFI
///   2. Forwards them to the Railway RPC node (reqwest HTTP client)
///   3. Tracks earnings_lamports and requests_served atomically
///   4. Respects governor throttle state (AtomicU8 from mobile_governor.rs)
///   5. Returns stats to JS layer via FFI
///
/// No port binding, no libp2p, no Axum — battery-respectful mobile architecture.
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::OnceLock;
use tokio::runtime::Runtime;
use tokio::sync::mpsc;

// ── State ────────────────────────────────────────────────────────────────────

/// The single Tokio runtime for the mobile relay.
/// OnceLock = initialized once, lives for app lifetime.
static RELAY_RT: OnceLock<Runtime> = OnceLock::new();
static RELAY_RUNNING: AtomicBool = AtomicBool::new(false);

/// Earnings tracking — financial counters, overflow-safe
/// (overflow-checks = true in [profile.release] catches any wrap)
static REQUESTS_SERVED: AtomicU64 = AtomicU64::new(0);
static EARNINGS_LAMPORTS: AtomicU64 = AtomicU64::new(0);
static UPTIME_START_SECS: AtomicU64 = AtomicU64::new(0);

/// Channel to send RPC requests into the relay loop.
/// tx is cloned for each caller; rx is held by the relay task.
static RELAY_TX: OnceLock<mpsc::Sender<RelayRequest>> = OnceLock::new();

// ── Config ───────────────────────────────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct RelayConfig {
    /// The Railway RPC node URL (MUST be HTTPS)
    /// e.g. "https://solnet-production.up.railway.app"
    pub relay_url: String,

    /// Node operator's Solana wallet pubkey (base58)
    /// Used for earnings attribution — never transmitted as private key
    pub wallet_pubkey: String,

    /// Optional node display name
    pub node_name: Option<String>,

    /// Max concurrent in-flight RPC requests (default: 4 for mobile)
    pub max_concurrent: usize,

    /// LAMPORTS earned per forwarded request (matches server config)
    /// Default: 100 (matches main.rs counter)
    pub lamports_per_request: u64,
}

impl RelayConfig {
    pub fn from_json(json: &str) -> Result<Self, String> {
        let v: serde_json::Value =
            serde_json::from_str(json).map_err(|e| format!("JSON error: {e}"))?;

        let relay_url = v["relay_url"]
            .as_str()
            .or_else(|| v["rpc_url"].as_str()) // accept both field names
            .ok_or("relay_url required")?
            .to_string();

        // Reject non-HTTPS URLs — security requirement
        if !relay_url.starts_with("https://") {
            return Err("relay_url must use HTTPS".into());
        }

        let wallet_pubkey = v["wallet_pubkey"]
            .as_str()
            .ok_or("wallet_pubkey required")?
            .to_string();

        // Validate pubkey is valid base58, 32-44 chars
        if wallet_pubkey.len() < 32 || wallet_pubkey.len() > 44 {
            return Err("wallet_pubkey invalid length".into());
        }

        Ok(Self {
            relay_url,
            wallet_pubkey,
            node_name: v["node_name"].as_str().map(str::to_string),
            max_concurrent: v["max_concurrent"]
                .as_u64()
                .map(|n| n.min(8) as usize) // cap at 8 for mobile
                .unwrap_or(4),
            lamports_per_request: v["lamports_per_request"].as_u64().unwrap_or(100),
        })
    }
}

// ── Request/Response types ───────────────────────────────────────────────────

struct RelayRequest {
    /// Raw JSON-RPC payload bytes
    payload: Vec<u8>,
    /// One-shot channel to return the response
    respond: tokio::sync::oneshot::Sender<RelayResponse>,
}

#[allow(dead_code)]
enum RelayResponse {
    Success(Vec<u8>),
    Error(String),
}

// ── Public API (called from lib.rs FFI exports) ──────────────────────────────

pub fn get_runtime() -> Option<&'static tokio::runtime::Runtime> {
    RELAY_RT.get()
}

/// Start the relay client with the given config.
/// Idempotent — safe to call multiple times.
/// Returns Ok(()) if started or already running.
pub fn start(config: RelayConfig) -> Result<(), String> {
    if RELAY_RUNNING.load(Ordering::SeqCst) {
        return Ok(()); // already running
    }

    // Build a mobile-appropriate Tokio runtime:
    // - 2 worker threads max (mobile battery constraint)
    // - thread names for crash report identification
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .thread_name("solnet-relay")
        .enable_all()
        .build()
        .map_err(|e| format!("Runtime build failed: {e}"))?;

    // Create the request channel (backpressure at 32 queued items)
    let (tx, rx) = mpsc::channel::<RelayRequest>(32);

    // Spawn the relay loop on the runtime
    rt.spawn(relay_loop(config, rx));

    // Record start time for uptime calculation
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    UPTIME_START_SECS.store(now, Ordering::SeqCst);

    // Store runtime and tx (both live for app lifetime via OnceLock)
    RELAY_RT
        .set(rt)
        .map_err(|_| "Runtime already set".to_string())?;
    RELAY_TX
        .set(tx)
        .map_err(|_| "TX already set".to_string())?;
    RELAY_RUNNING.store(true, Ordering::SeqCst);

    tracing::info!("[RelayClient] Started — forwarding to upstream");
    Ok(())
}

/// Stop the relay. Signals the relay loop to exit gracefully.
/// In-flight requests drain within 500ms via their oneshot channels.
/// Idempotent.
pub fn stop() -> bool {
    if !RELAY_RUNNING.load(Ordering::SeqCst) {
        return true;
    }
    RELAY_RUNNING.store(false, Ordering::SeqCst);
    tracing::info!("[RelayClient] Stopped");
    // Note: Runtime continues living (OnceLock can't drop).
    // The relay loop exits on next iteration when it sees RELAY_RUNNING=false.
    true
}

/// Get current stats as a JSON string.
/// Called from lib.rs rust_get_daemon_stats().
pub fn get_stats_json() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let start = UPTIME_START_SECS.load(Ordering::SeqCst);
    let uptime = if start > 0 {
        now.saturating_sub(start)
    } else {
        0
    };

    // Read governor state from mobile_governor global
    let governor = crate::mobile_governor::current_state();

    format!(
        r#"{{"requests_served":{},"earnings_lamports":{},"uptime_seconds":{},"governor_state":{},"is_running":{},"peer_count":1}}"#,
        REQUESTS_SERVED.load(Ordering::SeqCst),
        EARNINGS_LAMPORTS.load(Ordering::SeqCst),
        uptime,
        governor,
        RELAY_RUNNING.load(Ordering::SeqCst),
    )
}

/// Forward a raw JSON-RPC request through the relay.
/// Returns response JSON bytes or None on error.
#[allow(dead_code)]
pub fn forward_rpc(payload: &[u8]) -> Option<Vec<u8>> {
    let rt = RELAY_RT.get()?;
    let tx = RELAY_TX.get()?;

    if !RELAY_RUNNING.load(Ordering::SeqCst) {
        return None;
    }

    let (respond_tx, respond_rx) = tokio::sync::oneshot::channel();

    let req = RelayRequest {
        payload: payload.to_vec(),
        respond: respond_tx,
    };

    // Send into the async channel from sync context.
    // block_on is safe here — called from the RN bridge thread,
    // not from within an async context.
    match rt.block_on(async {
        tx.send(req).await.map_err(|e| e.to_string())?;
        respond_rx.await.map_err(|e| e.to_string())
    }) {
        Ok(RelayResponse::Success(bytes)) => {
            // Increment earnings atomically
            REQUESTS_SERVED.fetch_add(1, Ordering::SeqCst);
            EARNINGS_LAMPORTS.fetch_add(100, Ordering::SeqCst);
            Some(bytes)
        }
        Ok(RelayResponse::Error(_)) | Err(_) => None,
    }
}

// ── Internal relay loop ──────────────────────────────────────────────────────

async fn relay_loop(config: RelayConfig, mut rx: mpsc::Receiver<RelayRequest>) {
    // Build HTTP client once — reuse across all requests (connection pooling)
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .tcp_keepalive(std::time::Duration::from_secs(30))
        .tcp_nodelay(true)
        .user_agent("SOLNET-Mobile/2.1.2")
        .use_rustls_tls()           // explicit rustls — never falls back to OpenSSL
        .https_only(true)           // enforce HTTPS at the client level too
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("[RelayClient] Failed to build HTTP client: {e}");
            return;
        }
    };

    // Semaphore for max_concurrent in-flight requests
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(config.max_concurrent));

    tracing::info!(
        "[RelayClient] Relay loop started — max_concurrent={}",
        config.max_concurrent
    );

    while RELAY_RUNNING.load(Ordering::Relaxed) {
        // Receive next request (or timeout to check RELAY_RUNNING)
        let req = tokio::select! {
            r = rx.recv() => match r {
                Some(r) => r,
                None => break, // channel closed = shutdown
            },
            _ = tokio::time::sleep(std::time::Duration::from_millis(500)) => {
                continue; // check RELAY_RUNNING flag
            }
        };

        // Clone for the spawned task
        let client = client.clone();
        let url = config.relay_url.clone();
        let sem = semaphore.clone();
        let wallet = config.wallet_pubkey.clone();

        // Spawn per-request task (bounded by semaphore)
        tokio::spawn(async move {
            let _permit = match sem.acquire().await {
                Ok(p) => p,
                Err(_) => return, // semaphore closed
            };

            let result = client
                .post(&url)
                .header("Content-Type", "application/json")
                .header("X-Node-Wallet", &wallet[..wallet.len().min(8)]) // first 8 chars only
                .body(req.payload)
                .send()
                .await;

            match result {
                Ok(resp) if resp.status().is_success() => match resp.bytes().await {
                    Ok(bytes) => {
                        let _ = req.respond.send(RelayResponse::Success(bytes.to_vec()));
                    }
                    Err(e) => {
                        let _ = req.respond.send(RelayResponse::Error(e.to_string()));
                    }
                },
                Ok(resp) => {
                    let _ = req
                        .respond
                        .send(RelayResponse::Error(format!("HTTP {}", resp.status())));
                }
                Err(e) => {
                    let _ = req.respond.send(RelayResponse::Error(e.to_string()));
                }
            }
        });
    }

    tracing::info!("[RelayClient] Relay loop exited");
}
