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
pub mod relay_client;

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
    // Sync to the global state readable by relay_client
    mobile_governor::update_global_state(clamped);
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
    let ts = ThrottleState::from_str(state_str);
    governor().set_state(ts);
    mobile_governor::update_global_state(ts as u8);
}

// ── FFI: Daemon lifecycle (legacy — kept for backward compatibility) ──────────

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

// ── FFI: Relay client lifecycle ───────────────────────────────────────────────

/// Start the mobile relay client with JSON configuration.
///
/// config_json: UTF-8 JSON, null-terminated. Required fields:
///   { "relay_url": "https://...", "wallet_pubkey": "base58..." }
/// Optional: "node_name", "max_concurrent" (1-8), "lamports_per_request"
///
/// relay_url MUST be HTTPS — returns false otherwise.
/// Thread safe. Idempotent — safe to call multiple times.
///
/// # Safety
/// `config_json` must be a valid null-terminated UTF-8 C string, or NULL.
#[no_mangle]
pub extern "C" fn rust_start_relay(config_json: *const c_char) -> bool {
    if config_json.is_null() {
        return false;
    }
    let json = unsafe {
        match CStr::from_ptr(config_json).to_str() {
            Ok(s) => s.to_owned(),
            Err(_) => return false,
        }
    };
    match relay_client::RelayConfig::from_json(&json) {
        Ok(config) => relay_client::start(config).is_ok(),
        Err(e) => {
            // Log the config error without logging config values
            // (may contain wallet pubkey)
            tracing::warn!("[FFI] rust_start_relay: config error: {}", e);
            false
        }
    }
}

/// Stop the mobile relay. Drains in-flight requests (up to 500ms).
/// Thread safe. Idempotent.
#[no_mangle]
pub extern "C" fn rust_stop_relay() -> bool {
    relay_client::stop()
}

// ── FFI: Stats + memory management ────────────────────────────────────────────

/// Return current daemon/relay statistics as a heap-allocated JSON C string.
///
/// CALLER MUST free the returned pointer with `rust_free_string()`.
/// Returns NULL on allocation failure.
/// DO NOT use the pointer after calling rust_free_string().
#[no_mangle]
pub extern "C" fn rust_get_daemon_stats() -> *mut c_char {
    let json = relay_client::get_stats_json();
    match CString::new(json) {
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

// ── Android JNI wrappers ─────────────────────────────────────────────────────
// Only compiled when building for Android with `--features android-jni`.
// These bridge the JNI name-mangled function signatures to the flat
// extern "C" functions above.
//
// Package: network.solnet.app
// Class:   SolnetDaemonModule

#[cfg(feature = "android-jni")]
mod jni_bridge {
    use jni::JNIEnv;
    use jni::objects::{JByteArray, JClass, JString};
    use jni::sys::{jboolean, jbyte, jstring, JNI_FALSE, JNI_TRUE};
    use std::sync::atomic::Ordering;

    #[no_mangle]
    pub extern "system" fn Java_network_solnet_app_SolnetDaemonModule_rustInitGovernor<'local>(
        env: JNIEnv<'local>,
        _class: JClass<'local>,
        token: JByteArray<'local>,
    ) -> jboolean {
        let bytes: Vec<u8> = match env.convert_byte_array(&token) {
            Ok(b) => b,
            Err(_) => return JNI_FALSE,
        };
        if bytes.len() != 32 {
            return JNI_FALSE;
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        if super::GOVERNOR_TOKEN.set(arr).is_ok() {
            JNI_TRUE
        } else {
            JNI_FALSE
        }
    }

    #[no_mangle]
    pub extern "system" fn Java_network_solnet_app_SolnetDaemonModule_rustStartRelay<'local>(
        mut env: JNIEnv<'local>,
        _class: JClass<'local>,
        config_json: JString<'local>,
    ) -> jboolean {
        let json: String = match env.get_string(&config_json) {
            Ok(s) => s.into(),
            Err(_) => return JNI_FALSE,
        };
        match super::relay_client::RelayConfig::from_json(&json) {
            Ok(config) => {
                if super::relay_client::start(config).is_ok() {
                    JNI_TRUE
                } else {
                    JNI_FALSE
                }
            }
            Err(_) => JNI_FALSE,
        }
    }

    #[no_mangle]
    pub extern "system" fn Java_network_solnet_app_SolnetDaemonModule_rustStopRelay<'local>(
        _env: JNIEnv<'local>,
        _class: JClass<'local>,
    ) -> jboolean {
        if super::relay_client::stop() {
            JNI_TRUE
        } else {
            JNI_FALSE
        }
    }

    #[no_mangle]
    pub extern "system" fn Java_network_solnet_app_SolnetDaemonModule_rustGetDaemonStats<'local>(
        env: JNIEnv<'local>,
        _class: JClass<'local>,
    ) -> jstring {
        let stats = super::relay_client::get_stats_json();
        // JNI strings are managed by JVM GC — no rust_free_string needed
        env.new_string(stats)
            .map(|s| s.into_raw())
            .unwrap_or(std::ptr::null_mut())
    }

    #[no_mangle]
    pub extern "system" fn Java_network_solnet_app_SolnetDaemonModule_rustSetThrottleStateAuthenticated<'local>(
        env: JNIEnv<'local>,
        _class: JClass<'local>,
        state: jbyte,
        token: JByteArray<'local>,
    ) -> jboolean {
        let bytes: Vec<u8> = match env.convert_byte_array(&token) {
            Ok(b) => b,
            Err(_) => return JNI_FALSE,
        };
        if bytes.len() != 32 {
            return JNI_FALSE;
        }
        let expected = match super::GOVERNOR_TOKEN.get() {
            Some(t) => t,
            None => return JNI_FALSE,
        };

        // Constant-time comparison — same pattern as the C FFI path
        let mut diff: u8 = 0;
        for (a, b) in bytes.iter().zip(expected.iter()) {
            diff |= a ^ b;
        }
        if diff != 0 {
            return JNI_FALSE;
        }

        let clamped = (state as u8).min(2);
        super::GOVERNOR_STATE.store(clamped, Ordering::SeqCst);
        super::governor().set_state(super::mobile_governor::ThrottleState::from_u8(clamped));
        super::mobile_governor::update_global_state(clamped);
        JNI_TRUE
    }
}
