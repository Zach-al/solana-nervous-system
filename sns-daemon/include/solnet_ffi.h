#ifndef solnet_ffi_h
#define solnet_ffi_h

#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

/**
 * Enterprise Consolidated FFI Header for SOLNET Native.
 * These functions are implemented in sns-daemon/src/lib.rs.
 */

// Lifecycle & Governor
bool solnet_init_governor(const uint8_t *token, size_t len);
bool solnet_set_throttle_state(uint8_t state, const uint8_t *token, size_t token_len);
uint8_t solnet_get_throttle_state(void);
char *solnet_get_daemon_stats(void);
void solnet_free_string(char *ptr);

// Relay
bool solnet_start_relay(const char *config_json, const uint8_t *token, size_t token_len);
bool solnet_stop_relay(const uint8_t *token, size_t token_len);

// Crypto Primitives
char *solnet_generate_keypair(const uint8_t *token, size_t token_len);
char *solnet_sign_transaction(const char *secret_key_hex, const char *message, const uint8_t *token, size_t token_len);
char *solnet_get_random_bytes(size_t length);

#endif /* solnet_ffi_h */
