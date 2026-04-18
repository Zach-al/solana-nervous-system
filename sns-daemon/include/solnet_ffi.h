#pragma once

/**
 * solnet_ffi.h — C FFI interface for the SOLNET Rust daemon.
 *
 * iOS:     Import via SOLNET-Bridging-Header.h
 * Android: Load via System.loadLibrary("sns_daemon"), declare JNI externals
 *
 * OWNERSHIP RULES:
 *   - rust_get_daemon_stats() returns a HEAP-ALLOCATED string.
 *   - The caller MUST free it with rust_free_string().
 *   - rust_free_string(NULL) is a safe no-op.
 *   - NEVER call rust_free_string() twice on the same pointer.
 *   - SET YOUR POINTER TO NULL after calling rust_free_string().
 */

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Initialise the governor with a 32-byte session token.
 * Must be called once before any authenticated throttle calls.
 *
 * @param token  Pointer to 32 random bytes.
 * @param len    Must be exactly 32.
 * @return       true on success, false if invalid or already initialised.
 */
bool rust_init_governor(const uint8_t* token, size_t len);

/**
 * Set the throttle state with token authentication.
 * Constant-time token comparison prevents timing attacks.
 *
 * @param state      0 = FULL_POWER, 1 = CONSERVE, 2 = STANDBY
 * @param token      The 32-byte session token (must match init token).
 * @param token_len  Must be exactly 32.
 * @return           true if authenticated and state was updated.
 */
bool rust_set_throttle_state_authenticated(
    uint8_t state,
    const uint8_t* token,
    size_t token_len
);

/**
 * DEPRECATED — Unauthenticated throttle setter.
 * Logs a warning. Use rust_set_throttle_state_authenticated() instead.
 *
 * @param state  Null-terminated UTF-8 string: "FULL_POWER", "CONSERVE", "STANDBY"
 */
void rust_set_throttle_state(const char* state);

/**
 * Start the Rust daemon in a background thread (legacy).
 * Idempotent — safe to call multiple times.
 */
void rust_start_daemon(void);

/**
 * Gracefully stop the Rust daemon (legacy).
 */
void rust_stop_daemon(void);

/**
 * Start the mobile relay client.
 *
 * config_json: UTF-8 JSON, null-terminated. Required fields:
 *   { "relay_url": "https://...", "wallet_pubkey": "base58..." }
 * Optional: "node_name", "max_concurrent" (1-8), "lamports_per_request"
 *
 * relay_url MUST be HTTPS — returns false otherwise.
 * THREAD SAFE. Idempotent — safe to call multiple times.
 *
 * @param config_json  UTF-8 JSON configuration string.
 * @return             true on success, false on config error or init failure.
 */
bool rust_start_relay(const char* config_json);

/**
 * Stop the mobile relay. Drains in-flight requests (up to 500ms).
 * THREAD SAFE. Idempotent.
 *
 * @return  true always (idempotent).
 */
bool rust_stop_relay(void);

/**
 * Get current daemon/relay stats as a JSON C string.
 *
 * CALLER MUST FREE the returned pointer using rust_free_string().
 * Returns NULL on error.
 */
char* rust_get_daemon_stats(void);

/**
 * Free a string returned by rust_get_daemon_stats().
 *
 * Safe to call with NULL (no-op).
 * DO NOT call twice on the same pointer.
 * SET YOUR POINTER TO NULL after calling this.
 */
void rust_free_string(char* ptr);

#ifdef __cplusplus
}
#endif
