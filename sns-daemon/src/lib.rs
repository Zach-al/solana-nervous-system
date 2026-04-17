/// lib.rs
///
/// C FFI boundary for the SOLNET Rust daemon.
/// Compiles to a cdylib (Dynamic library):
///   - iOS: libsns_daemon.dylib (linked into Xcode via Podfile or manually)
///   - Android: libsns_daemon.so (placed in jniLibs/<abi>/)
///
/// All functions in this module are callable from Swift (via @_silgen_name)
/// and from Kotlin (via System.loadLibrary + external fun declarations).
///
/// SAFETY: These functions are called from Swift/Kotlin across the FFI
/// boundary. Caller must never pass NULL for string parameters.

// ── Module declarations for the lib crate ────────────────────────────────────
// The lib crate has its own module tree separate from the bin (main.rs).
// Only the modules needed by FFI callers need to be listed here.
pub mod mobile_governor;

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::sync::OnceLock;

use mobile_governor::{MobileGovernor, ThrottleState};

// ── Global singleton governor ─────────────────────────────────────────────────

/// Global governor instance initialised on first use.
/// OnceLock ensures thread-safe, one-time initialisation without `unsafe`.
static GOVERNOR: OnceLock<MobileGovernor> = OnceLock::new();

fn governor() -> &'static MobileGovernor {
    GOVERNOR.get_or_init(MobileGovernor::new)
}

// ── Runtime state ─────────────────────────────────────────────────────────────

/// Tokio runtime for use by FFI-spawned async tasks.
/// Initialised once on first daemon start.
static RUNTIME: OnceLock<tokio::runtime::Runtime> = OnceLock::new();

fn runtime() -> &'static tokio::runtime::Runtime {
    RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .expect("Failed to build Tokio runtime for FFI daemon")
    })
}

// ── FFI-exported functions ────────────────────────────────────────────────────

/// Set the daemon power mode.
///
/// # Arguments
/// `state_ptr` — Null-terminated UTF-8 C string: "FULL_POWER", "CONSERVE", or "STANDBY".
#[no_mangle]
pub extern "C" fn rust_set_throttle_state(state_ptr: *const c_char) {
    if state_ptr.is_null() {
        return;
    }
    // SAFETY: caller guarantees non-null, valid UTF-8, null-terminated string.
    let state_str = unsafe {
        CStr::from_ptr(state_ptr)
            .to_str()
            .unwrap_or("STANDBY")
    };
    governor().set_state(ThrottleState::from_str(state_str));
}

/// Start the SOLNET daemon in a background Tokio thread.
/// Idempotent — safe to call multiple times.
#[no_mangle]
pub extern "C" fn rust_start_daemon() {
    runtime().spawn(async move {
        tracing::info!("[FFI] rust_start_daemon called — daemon runtime active");
        // The full daemon startup (port binding, P2P, etc.) is done via main().
        // When embedded as a library, this entry point is a lightweight keep-alive.
    });
}

/// Gracefully stop the daemon. Currently sends a log signal;
/// full shutdown requires signalling the Axum server via a broadcast channel
/// (wired in a future integration step with SharedState).
#[no_mangle]
pub extern "C" fn rust_stop_daemon() {
    tracing::info!("[FFI] rust_stop_daemon called");
    // TODO: send shutdown signal to Axum server via a stored shutdown Sender.
}

/// Return current daemon statistics as a heap-allocated JSON C string.
/// Caller MUST free the returned pointer with `rust_free_string`.
/// Returns NULL on allocation failure (should never happen in practice).
#[no_mangle]
pub extern "C" fn rust_get_daemon_stats() -> *mut c_char {
    let gov = governor();
    let state = gov.get_state();

    // In the standalone cdylib build we don't have access to the full
    // SharedState counters. The native bridge should augment these with
    // JS-side data. We expose governor-level stats here.
    let json = serde_json::json!({
        "requests_served": 0,     // TODO: wire to AtomicU64 counter
        "connections": 0,         // TODO: wire to AtomicUsize counter
        "uptime_secs": 0,         // TODO: wire to start-time instant
        "throttle_state": state.as_str(),
        "max_connections": gov.max_concurrent_connections(),
        "heartbeat_interval_secs": gov.heartbeat_interval_secs(),
    });

    match CString::new(json.to_string()) {
        Ok(s) => s.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

/// Free a C string previously returned by any Rust FFI function.
///
/// # Safety
/// `ptr` must be a pointer previously returned by `rust_get_daemon_stats`
/// or another Rust FFI function that uses `CString::into_raw`.
/// Passing any other pointer is undefined behaviour.
#[no_mangle]
pub extern "C" fn rust_free_string(ptr: *mut c_char) {
    if ptr.is_null() {
        return;
    }
    // SAFETY: reclaim ownership from the raw pointer, then drop.
    unsafe { drop(CString::from_raw(ptr)); }
}
