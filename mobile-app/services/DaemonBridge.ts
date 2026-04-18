/**
 * DaemonBridge.ts
 *
 * TypeScript bridge to the SolnetDaemon native module.
 * On iOS this calls Rust FFI via Swift (Keychain-authenticated).
 * On Android this calls Rust FFI via Kotlin/JNI (Keystore-authenticated).
 *
 * SECURITY:
 *   - In production builds, the native module MUST be present.
 *     A missing module in production = build configuration error → hard throw.
 *   - In development (Expo Go), runs in stub mode with explicit warnings.
 *   - Stub stats include `isStub: true` so the UI can show a "DEMO MODE" banner.
 *
 * ARCHITECTURE:
 *   The mobile node is a RELAY CLIENT, not a daemon. It forwards RPC calls
 *   to the Railway server via HTTPS and tracks earnings atomically.
 */

import { NativeModules, NativeEventEmitter, Platform, EmitterSubscription } from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ThrottleState = 'FULL_POWER' | 'CONSERVE' | 'STANDBY';

export interface RelayConfig {
  /** Railway RPC node URL — MUST be https:// */
  relay_url: string;
  /** Node operator's Solana wallet pubkey (base58) */
  wallet_pubkey: string;
  /** Optional node display name */
  node_name?: string;
  /** Max concurrent in-flight requests (1-8, default 4) */
  max_concurrent?: number;
  /** Lamports earned per forwarded request (default 100) */
  lamports_per_request?: number;
}

export interface DaemonStats {
  requests_served: number;
  earnings_lamports: number;
  uptime_seconds: number;
  governor_state: number;
  is_running: boolean;
  peer_count: number;
  /** True when the native module is absent and stats are simulated. */
  isStub: boolean;
}

// ─── Native Module Interface ─────────────────────────────────────────────────

interface SolnetDaemonNative {
  setThrottleState(state: ThrottleState): Promise<void>;
  startDaemon(): Promise<void>;
  stopDaemon(): Promise<void>;
  getDaemonStats(): Promise<Record<string, any>>;
  startRelay(configJson: string): Promise<{ ok: boolean; mode?: string }>;
  stopRelay(): Promise<{ ok: boolean }>;
}

// ─── Module Resolution ───────────────────────────────────────────────────────

const { SolnetDaemon: _NativeModule } = NativeModules as {
  SolnetDaemon: SolnetDaemonNative | undefined;
};

const IS_STUB = !_NativeModule;

// ─── Environment guards ─────────────────────────────────────────────────────

if (IS_STUB && __DEV__) {
  console.warn(
    '[DaemonBridge] ⚠️  Running in STUB mode. ' +
    'Native daemon is NOT active. ' +
    'Governor controls are simulated. ' +
    'Build a dev client with: npx expo run:ios / npx expo run:android'
  );
}

if (IS_STUB && !__DEV__) {
  // Production build without native module = fatal build configuration error.
  // This should never happen if the app was built correctly with
  // `expo run:ios` or `expo run:android` (not bare Expo Go).
  throw new Error(
    'DaemonBridge: Native module "SolnetDaemon" missing in production build. ' +
    'This is a build configuration error. The Rust daemon library ' +
    '(libsns_daemon.dylib / libsns_daemon.so) must be linked into the ' +
    'native project before publishing.'
  );
}

// ─── Event Emitter ───────────────────────────────────────────────────────────

const emitter = !IS_STUB
  ? new NativeEventEmitter(_NativeModule as any)
  : null;

// ─── Stub stats (returned when native module is absent) ──────────────────────

const STUB_STATS: DaemonStats = {
  requests_served: 0,
  earnings_lamports: 0,
  uptime_seconds: 0,
  governor_state: 0,
  is_running: false,
  peer_count: 0,
  isStub: true,
};

// ─── Public API ──────────────────────────────────────────────────────────────

export const DaemonBridge = {
  /** Whether the native Rust daemon module is present in this build. */
  isAvailable: !IS_STUB,

  /** True when running without the native module (Expo Go / dev). */
  isStub: IS_STUB,

  /**
   * Start the mobile relay client.
   * Validates config before crossing the native boundary.
   */
  async start(config: RelayConfig): Promise<{ ok: boolean; mode?: string; isStub: boolean }> {
    if (IS_STUB) return { ok: false, isStub: true };

    // Client-side validation before crossing native boundary
    if (!config.relay_url.startsWith('https://')) {
      throw new Error('relay_url must use HTTPS');
    }
    if (!config.wallet_pubkey || config.wallet_pubkey.length < 32) {
      throw new Error('wallet_pubkey required (min 32 chars)');
    }

    const result = await _NativeModule!.startRelay(JSON.stringify(config));
    return { ...result, isStub: false };
  },

  /** Stop the mobile relay. Drains in-flight requests gracefully. */
  async stop(): Promise<{ ok: boolean; isStub: boolean }> {
    if (IS_STUB) return { ok: true, isStub: true };
    const result = await _NativeModule!.stopRelay();
    return { ...result, isStub: false };
  },

  /**
   * Tell the Rust daemon which power mode to operate in.
   * In authenticated mode (iOS/Android), this uses a session token.
   * In stub mode, this is a no-op.
   */
  async setThrottleState(state: ThrottleState): Promise<void> {
    if (IS_STUB) return;
    return _NativeModule!.setThrottleState(state);
  },

  /**
   * Fetch runtime stats from the Rust relay client.
   * Returns stub stats with `isStub: true` when the module is unavailable.
   * Callers should check `isStub` and show a "DEMO MODE" indicator.
   */
  async getStats(): Promise<DaemonStats> {
    if (IS_STUB) return STUB_STATS;

    const raw = await _NativeModule!.getDaemonStats();
    // Android returns a WritableMap, iOS returns a dictionary
    // Both should have the same keys from relay_client::get_stats_json()
    return {
      requests_served: raw.requests_served ?? 0,
      earnings_lamports: raw.earnings_lamports ?? 0,
      uptime_seconds: raw.uptime_seconds ?? raw.uptime_secs ?? 0,
      governor_state: raw.governor_state ?? 0,
      is_running: raw.is_running ?? false,
      peer_count: raw.peer_count ?? 0,
      isStub: false,
    };
  },

  /**
   * Subscribe to throttle state change events emitted by Rust.
   * Returns null in stub mode.
   */
  onThrottleStateChange(
    callback: (newState: ThrottleState) => void
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('DaemonThrottleChanged', callback);
  },

  /**
   * Subscribe to raw daemon log events emitted by Rust.
   * Returns null in stub mode.
   */
  onLogLine(
    callback: (line: string) => void
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('DaemonLogLine', callback);
  },
} as const;
