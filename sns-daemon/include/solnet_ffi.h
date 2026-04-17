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
 * Start the Rust daemon in a background thread.
 * Idempotent — safe to call multiple times.
 */
void rust_start_daemon(void);

/**
 * Gracefully stop the Rust daemon.
 */
void rust_stop_daemon(void);

/**
 * Get current daemon stats as a JSON C string.
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
