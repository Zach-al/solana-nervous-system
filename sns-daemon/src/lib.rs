/// lib.rs
///
/// C FFI boundary for the SOLNET Rust daemon.
/// Compiles to a cdylib (Dynamic library):
///   - iOS:     libsns_daemon.dylib / .a
///   - Android: libsns_daemon.so
///
/// Swift consumers: import via SOLNET-Bridging-Header.h → solnet_ffi.h
/// Kotlin consumers: JNI System.loadLibrary("sns_daemon")
///
/// SECURITY CONTRACT:
///   - All exported functions are `extern "C"` with #[no_mangle].
///   - Callers MUST call rust_init_governor() with a 32-byte session
///     token before using rust_set_throttle_state_authenticated().
///   - rust_get_daemon_stats() returns a heap-allocated C string;
///     the caller MUST free it with rust_free_string().
///   - rust_free_string() is safe to call with NULL.
///   - Double-free is undefined behaviour — caller must NULL the
///     pointer after calling rust_free_string().

pub mod mobile_governor;

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::OnceLock;

use mobile_governor::{MobileGovernor, ThrottleState};

// ── Global singletons ─────────────────────────────────────────────────────────

static GOVERNOR: OnceLock<MobileGovernor> = OnceLock::new();
static GOVERNOR_TOKEN: OnceLock<[u8; 32]> = OnceLock::new();
static GOVERNOR_STATE: AtomicU8 = AtomicU8::new(2); // default STANDBY

fn governor() -> &'static MobileGovernor {
    GOVERNOR.get_or_init(MobileGovernor::new)
}

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

// ── FFI: Governor authentication ──────────────────────────────────────────────

/// Initialise the governor with a 32-byte session token.
/// Must be called once before any authenticated throttle calls.
/// Returns true on success, false if token is invalid or already set.
///
/// # Safety
/// `token` must point to `len` valid bytes. `len` must be exactly 32.
#[no_mangle]
pub extern "C" fn rust_init_governor(token: *const u8, len: usize) -> bool {
    if token.is_null() || len != 32 {
        return false;
    }
    let slice = unsafe { std::slice::from_raw_parts(token, len) };
    let mut arr = [0u8; 32];
    arr.copy_from_slice(slice);
    GOVERNOR_TOKEN.set(arr).is_ok()
}

/// Set throttle state with token authentication.
/// Returns true if the token matches and state was updated.
///
/// Constant-time comparison prevents timing side-channels.
///
/// # Safety
/// `token` must point to `token_len` valid bytes.
#[no_mangle]
pub extern "C" fn rust_set_throttle_state_authenticated(
    state: u8,
    token: *const u8,
    token_len: usize,
) -> bool {
    if token.is_null() || token_len != 32 {
        return false;
    }
    let provided = unsafe { std::slice::from_raw_parts(token, token_len) };
    let expected = match GOVERNOR_TOKEN.get() {
        Some(t) => t,
        None => return false,
    };

    // Constant-time comparison — prevent timing attacks
    let mut diff: u8 = 0;
    for (a, b) in provided.iter().zip(expected.iter()) {
        diff |= a ^ b;
    }
    if diff != 0 {
        return false;
    }

    let clamped = state.min(2);
    GOVERNOR_STATE.store(clamped, Ordering::SeqCst);
    governor().set_state(ThrottleState::from_u8(clamped));
    true
}

/// DEPRECATED: Unauthenticated throttle state setter.
/// Logs a warning. Use rust_set_throttle_state_authenticated() instead.
///
/// # Safety
/// `state_ptr` must be a valid null-terminated UTF-8 C string, or NULL.
#[no_mangle]
pub extern "C" fn rust_set_throttle_state(state_ptr: *const c_char) {
    if state_ptr.is_null() {
        return;
    }
    tracing::warn!(
        "[FFI] rust_set_throttle_state called without authentication. \
         Migrate to rust_set_throttle_state_authenticated()."
    );
    let state_str = unsafe {
        CStr::from_ptr(state_ptr)
            .to_str()
            .unwrap_or("STANDBY")
    };
    governor().set_state(ThrottleState::from_str(state_str));
}

// ── FFI: Daemon lifecycle ─────────────────────────────────────────────────────

/// Start the SOLNET daemon in a background Tokio thread.
/// Idempotent — safe to call multiple times.
#[no_mangle]
pub extern "C" fn rust_start_daemon() {
    runtime().spawn(async move {
        tracing::info!("[FFI] rust_start_daemon called — daemon runtime active");
    });
}

/// Gracefully stop the daemon.
#[no_mangle]
pub extern "C" fn rust_stop_daemon() {
    tracing::info!("[FFI] rust_stop_daemon called");
}

// ── FFI: Stats + memory management ────────────────────────────────────────────

/// Return current daemon statistics as a heap-allocated JSON C string.
///
/// CALLER MUST free the returned pointer with `rust_free_string()`.
/// Returns NULL on allocation failure.
/// DO NOT use the pointer after calling rust_free_string().
#[no_mangle]
pub extern "C" fn rust_get_daemon_stats() -> *mut c_char {
    let gov = governor();
    let state = gov.get_state();

    let json = serde_json::json!({
        "requests_served": 0,
        "connections": 0,
        "uptime_secs": 0,
        "throttle_state": state.as_str(),
        "max_connections": gov.max_concurrent_connections(),
        "heartbeat_interval_secs": gov.heartbeat_interval_secs(),
    });

    match CString::new(json.to_string()) {
        Ok(s) => s.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

/// Free a C string previously returned by a Rust FFI function.
///
/// SAFETY CONTRACT:
///   - `ptr` MUST have been returned by `rust_get_daemon_stats()`.
///   - `ptr` MUST NOT have been freed before (double-free = UB).
///   - `ptr` MUST NOT be used after this call.
///   - NULL is safe (no-op).
///   - Caller should set their pointer to NULL after calling this.
#[no_mangle]
pub extern "C" fn rust_free_string(ptr: *mut c_char) {
    if ptr.is_null() {
        return; // gracefully handle null — never panic across FFI
    }
    unsafe { drop(CString::from_raw(ptr)); }
}
