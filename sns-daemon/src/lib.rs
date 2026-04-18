/// lib.rs
///
/// Enterprise consolidated FFI boundary for the SOLNET native core.
/// Compiles to libsolnet_native (.so / .a).
///
/// SECURITY MODEL:
/// - Hardware-backed session authentication (Keystore/Keychain).
/// - Constant-time token comparison for all protected operations.
/// - Memory safety: Caller MUST call solnet_free_string() for all *mut c_char returns.

pub mod mobile_governor;
pub mod relay_client;

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::OnceLock;
use ed25519_dalek::{SigningKey, VerifyingKey, Signer};
use rand::rngs::OsRng;
use rand::RngCore;

use mobile_governor::{MobileGovernor, ThrottleState};

// ── Globals ──────────────────────────────────────────────────────────────────

static GOVERNOR: OnceLock<MobileGovernor> = OnceLock::new();
static GOVERNOR_TOKEN: OnceLock<[u8; 32]> = OnceLock::new();
static GOVERNOR_STATE: AtomicU8 = AtomicU8::new(2); // default STANDBY

fn governor() -> &'static MobileGovernor {
    GOVERNOR.get_or_init(MobileGovernor::new)
}

// ── Helper: Authentication ────────────────────────────────────────────────────

fn check_auth(token: *const u8, len: usize) -> bool {
    if token.is_null() || len != 32 {
        return false;
    }
    let provided = unsafe { std::slice::from_raw_parts(token, len) };
    let expected = match GOVERNOR_TOKEN.get() {
        Some(t) => t,
        None => return false,
    };

    let mut diff: u8 = 0;
    for (a, b) in provided.iter().zip(expected.iter()) {
        diff |= a ^ b;
    }
    diff == 0
}

// ── FFI: Crypto Primitives ────────────────────────────────────────────────────

/// Generate Ed25519 keypair. Returns JSON string: {"publicKey": "...", "secretKey": "..."}
/// Requires session token authentication.
#[no_mangle]
pub extern "C" fn solnet_generate_keypair(token: *const u8, token_len: usize) -> *mut c_char {
    if !check_auth(token, token_len) {
        return std::ptr::null_mut();
    }

    let mut seed = [0u8; 32];
    OsRng.fill_bytes(&mut seed);
    let signing_key = SigningKey::from_bytes(&seed);
    let verifying_key: VerifyingKey = signing_key.verifying_key();
    
    let keypair = serde_json::json!({
        "publicKey": hex::encode(verifying_key.as_bytes()),
        "secretKey": hex::encode(signing_key.to_bytes()),
    });
    
    CString::new(keypair.to_string())
        .unwrap_or_else(|_| CString::new("error").unwrap())
        .into_raw()
}

/// Sign message using Ed25519. Returns hex signature string.
/// Requires session token authentication.
#[no_mangle]
pub extern "C" fn solnet_sign_transaction(
    secret_key_hex: *const c_char,
    message: *const c_char,
    token: *const u8,
    token_len: usize,
) -> *mut c_char {
    if !check_auth(token, token_len) || secret_key_hex.is_null() || message.is_null() {
        return std::ptr::null_mut();
    }

    unsafe {
        let secret_str = match CStr::from_ptr(secret_key_hex).to_str() {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        };
        let msg = match CStr::from_ptr(message).to_str() {
            Ok(s) => s.as_bytes(),
            Err(_) => return std::ptr::null_mut(),
        };
        
        let secret_bytes = match hex::decode(secret_str) {
            Ok(b) => b,
            Err(_) => return std::ptr::null_mut(),
        };

        let secret_arr: [u8; 32] = match secret_bytes.try_into() {
            Ok(a) => a,
            Err(_) => return std::ptr::null_mut(),
        };

        let signing_key = SigningKey::from_bytes(&secret_arr);
        let signature = signing_key.sign(msg);
        
        CString::new(hex::encode(signature.to_bytes()))
            .unwrap_or_else(|_| CString::new("error").unwrap())
            .into_raw()
    }
}

/// Get random bytes from OsRng. Returns hex string.
#[no_mangle]
pub extern "C" fn solnet_get_random_bytes(length: usize) -> *mut c_char {
    let mut bytes = vec![0u8; length];
    OsRng.fill_bytes(&mut bytes);
    
    CString::new(hex::encode(bytes))
        .unwrap_or_else(|_| CString::new("error").unwrap())
        .into_raw()
}

// ── FFI: Lifecycle & Governor ────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn solnet_init_governor(token: *const u8, len: usize) -> bool {
    if token.is_null() || len != 32 {
        return false;
    }
    let slice = unsafe { std::slice::from_raw_parts(token, len) };
    let mut arr = [0u8; 32];
    arr.copy_from_slice(slice);
    GOVERNOR_TOKEN.set(arr).is_ok()
}

#[no_mangle]
pub extern "C" fn solnet_set_throttle_state(state: u8, token: *const u8, token_len: usize) -> bool {
    if !check_auth(token, token_len) {
        return false;
    }
    let clamped = state.min(2);
    GOVERNOR_STATE.store(clamped, Ordering::SeqCst);
    governor().set_state(ThrottleState::from_u8(clamped));
    mobile_governor::update_global_state(clamped);
    push_log_to_java(&format!("Throttle state manually updated to: {:?}", clamped));
    true
}

#[no_mangle]
pub extern "C" fn solnet_get_throttle_state() -> u8 {
    GOVERNOR_STATE.load(Ordering::SeqCst)
}

#[no_mangle]
pub extern "C" fn solnet_start_relay(config_json: *const c_char, token: *const u8, token_len: usize) -> bool {
    if !check_auth(token, token_len) || config_json.is_null() {
        return false;
    }
    let json = unsafe {
        match CStr::from_ptr(config_json).to_str() {
            Ok(s) => s.to_owned(),
            Err(_) => return false,
        }
    };
    match relay_client::RelayConfig::from_json(&json) {
        Ok(config) => {
            push_log_to_java("Initializing Enterprise Relay Client...");
            let res = relay_client::start(config).is_ok();
            if res { push_log_to_java("✅ Relay Client ACTIVE"); }
            res
        },
        Err(_) => {
            push_log_to_java("❌ FAILED to initialize Relay: Invalid Config JSON");
            false
        },
    }
}

#[no_mangle]
pub extern "C" fn solnet_stop_relay(token: *const u8, token_len: usize) -> bool {
    if !check_auth(token, token_len) {
        return false;
    }
    push_log_to_java("Stopping Relay Client...");
    relay_client::stop()
}

#[no_mangle]
pub extern "C" fn solnet_get_daemon_stats() -> *mut c_char {
    let json = relay_client::get_stats_json();
    CString::new(json)
        .map(|s| s.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

#[no_mangle]
pub extern "C" fn solnet_free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe { drop(CString::from_raw(ptr)); }
    }
}

// ── JNI: Android Bridges (com.solnet.mobile.SolnetNative) ─────────────────────

#[cfg(feature = "android-jni")]
pub mod jni_bridge {
    use super::*;
    use jni::JNIEnv;
    use jni::objects::{JByteArray, JClass, JString};
    use jni::sys::{jboolean, jbyte, jint, jstring, JNI_FALSE, JNI_TRUE};

    #[no_mangle]
    pub extern "system" fn Java_com_solnet_mobile_SolnetNative_solnetInitGovernor<'local>(
        env: JNIEnv<'local>,
        _class: JClass<'local>,
        token: JByteArray<'local>,
    ) -> jboolean {
        let bytes = match env.convert_byte_array(&token) {
            Ok(b) => b,
            Err(_) => return JNI_FALSE,
        };
        if solnet_init_governor(bytes.as_ptr(), bytes.len()) { JNI_TRUE } else { JNI_FALSE }
    }

    #[no_mangle]
    pub extern "system" fn Java_com_solnet_mobile_SolnetNative_solnetGetRandomBytes<'local>(
        env: JNIEnv<'local>,
        _class: JClass<'local>,
        length: jint,
    ) -> jstring {
        let ptr = solnet_get_random_bytes(length as usize);
        let res = unsafe { CStr::from_ptr(ptr) }.to_str().unwrap_or("error");
        let output = env.new_string(res).unwrap().into_raw();
        solnet_free_string(ptr);
        output
    }

    #[no_mangle]
    pub extern "system" fn Java_com_solnet_mobile_SolnetNative_solnetGenerateKeypair<'local>(
        env: JNIEnv<'local>,
        _class: JClass<'local>,
        token: JByteArray<'local>,
    ) -> jstring {
        let auth = match env.convert_byte_array(&token) {
            Ok(b) => b,
            Err(_) => return std::ptr::null_mut(),
        };
        let ptr = solnet_generate_keypair(auth.as_ptr(), auth.len());
        if ptr.is_null() { return std::ptr::null_mut(); }
        let res = unsafe { CStr::from_ptr(ptr) }.to_str().unwrap_or("error");
        let output = env.new_string(res).unwrap().into_raw();
        solnet_free_string(ptr);
        output
    }

    #[no_mangle]
    pub extern "system" fn Java_com_solnet_mobile_SolnetNative_solnetSignTransaction<'local>(
        mut env: JNIEnv<'local>,
        _class: JClass<'local>,
        secret_key: JString<'local>,
        message: JString<'local>,
        token: JByteArray<'local>,
    ) -> jstring {
        let sk: String = env.get_string(&secret_key).unwrap().into();
        let msg: String = env.get_string(&message).unwrap().into();
        let auth = env.convert_byte_array(&token).unwrap();
        
        let c_sk = CString::new(sk).unwrap();
        let c_msg = CString::new(msg).unwrap();
        
        let ptr = solnet_sign_transaction(c_sk.as_ptr(), c_msg.as_ptr(), auth.as_ptr(), auth.len());
        if ptr.is_null() { return std::ptr::null_mut(); }
        let res = unsafe { CStr::from_ptr(ptr) }.to_str().unwrap_or("error");
        let output = env.new_string(res).unwrap().into_raw();
        solnet_free_string(ptr);
        output
    }

    #[no_mangle]
    pub extern "system" fn Java_com_solnet_mobile_SolnetNative_solnetStartRelay<'local>(
        mut env: JNIEnv<'local>,
        _class: JClass<'local>,
        config_json: JString<'local>,
        token: JByteArray<'local>,
    ) -> jboolean {
        let json: String = env.get_string(&config_json).unwrap().into();
        let auth = env.convert_byte_array(&token).unwrap();
        let c_json = CString::new(json).unwrap();
        if solnet_start_relay(c_json.as_ptr(), auth.as_ptr(), auth.len()) { JNI_TRUE } else { JNI_FALSE }
    }

    #[no_mangle]
    pub extern "system" fn Java_com_solnet_mobile_SolnetNative_solnetStopRelay<'local>(
        env: JNIEnv<'local>,
        _class: JClass<'local>,
        token: JByteArray<'local>,
    ) -> jboolean {
        let auth = env.convert_byte_array(&token).unwrap();
        if solnet_stop_relay(auth.as_ptr(), auth.len()) { JNI_TRUE } else { JNI_FALSE }
    }

    #[no_mangle]
    pub extern "system" fn Java_com_solnet_mobile_SolnetNative_solnetGetDaemonStats<'local>(
        env: JNIEnv<'local>,
        _class: JClass<'local>,
    ) -> jstring {
        let stats = relay_client::get_stats_json();
        env.new_string(stats).unwrap().into_raw()
    }

    #[no_mangle]
    pub extern "system" fn Java_com_solnet_mobile_SolnetNative_solnetSetThrottleState<'local>(
        env: JNIEnv<'local>,
        _class: JClass<'local>,
        state: jbyte,
        token: JByteArray<'local>,
    ) -> jboolean {
        let auth = env.convert_byte_array(&token).unwrap();
        if solnet_set_throttle_state(state as u8, auth.as_ptr(), auth.len()) { JNI_TRUE } else { JNI_FALSE }
    }

    #[no_mangle]
    pub extern "system" fn Java_com_solnet_mobile_SolnetNative_solnetGetThrottleState<'local>(
        _env: JNIEnv<'local>,
        _class: JClass<'local>,
    ) -> jint {
        solnet_get_throttle_state() as jint
    }

    #[no_mangle]
    pub extern "system" fn Java_com_solnet_mobile_SolnetNative_solnetRegisterLogCallback<'local>(
        env: JNIEnv<'local>,
        _class: JClass<'local>,
        callback: jni::objects::JObject<'local>,
    ) {
        if let Ok(jvm) = env.get_java_vm() {
            let _ = JAVA_VM.set(jvm);
        }
        if let Ok(glob) = env.new_global_ref(callback) {
            let _ = LOG_CALLBACK.set(glob);
        }
        
        // --- Initialize Tracing Bridge ---
        static INIT: std::sync::Once = std::sync::Once::new();
        INIT.call_once(|| {
            use tracing_subscriber::layer::SubscriberExt;
            use tracing_subscriber::util::SubscriberInitExt;
            
            let subscriber = tracing_subscriber::registry()
                .with(tracing_subscriber::EnvFilter::new("info"))
                .with(JniLayer);
            
            let _ = subscriber.try_init();
            push_log_to_java("📡 SOLNET Tracing Bridge Initialized");
        });
    }
}

#[cfg(feature = "android-jni")]
static JAVA_VM: OnceLock<jni::JavaVM> = OnceLock::new();
#[cfg(feature = "android-jni")]
static LOG_CALLBACK: OnceLock<jni::objects::GlobalRef> = OnceLock::new();

/// Custom tracing layer that forwards logs to the Android JNI callback
struct JniLayer;

impl<S: tracing::Subscriber> tracing_subscriber::Layer<S> for JniLayer {
    fn on_event(&self, event: &tracing::Event<'_>, _ctx: tracing_subscriber::layer::Context<'_, S>) {
        let mut visitor = JniLogVisitor::default();
        event.record(&mut visitor);
        
        let level = *event.metadata().level();
        let prefix = match level {
            tracing::Level::ERROR => "❌ ",
            tracing::Level::WARN => "⚠️ ",
            tracing::Level::INFO => "> ",
            _ => "  ",
        };
        
        if !visitor.message.is_empty() {
            push_log_to_java(&format!("{}{}", prefix, visitor.message));
        }
    }
}

#[derive(Default)]
struct JniLogVisitor {
    message: String,
}

impl tracing::field::Visit for JniLogVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        if field.name() == "message" {
            self.message = format!("{:?}", value).replace("\"", "");
        }
    }
    
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" {
            self.message = value.to_string();
        }
    }
}

/// Internal helper to push a log line to the Java UI.
pub fn push_log_to_java(line: &str) {
    #[cfg(feature = "android-jni")]
    {
        if let (Some(jvm), Some(callback)) = (JAVA_VM.get(), LOG_CALLBACK.get()) {
            if let Ok(mut env) = jvm.attach_current_thread() {
                if let Ok(jline) = env.new_string(line) {
                    let _ = env.call_method(
                        callback,
                        "onDaemonLog",
                        "(Ljava/lang/String;)V",
                        &[jni::objects::JValue::from(&jline)],
                    );
                }
            }
        }
    }
    // Also output to stdout for logcat with distinct tagging
    println!("SOLNET_NATIVE_LOG|{}", line);
}
