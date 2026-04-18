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

import { NativeModules, DeviceEventEmitter, Platform, EmitterSubscription } from 'react-native';

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

interface SolnetNativeInterface {
  // Crypto Primitives
  generateKeypair(): Promise<string>; // Returns JSON string
  getRandomBytes(length: number): Promise<string>; // Returns hex string
  signTransaction(secretKey: string, message: string): Promise<string>; // Returns hex signature

  // Relay Lifecycle
  startRelay(configJson: string): Promise<boolean>;
  stopRelay(): Promise<boolean>;
  getDaemonStats(): Promise<Record<string, any>>;

  // Governor Controls
  setThrottleState(state: number): Promise<void>;
  getThrottleState(): Promise<number>;
}

// ─── Module Resolution ───────────────────────────────────────────────────────

/**
 * Enterprise Native Module Resolver.
 * Tries the new 'SolnetNative' name first, then falls back to 'SolnetDaemon'.
 */
const _NativeModule = (NativeModules.SolnetNative || NativeModules.SolnetDaemon) as 
  SolnetNativeInterface | undefined;

const IS_STUB = !_NativeModule;

// ─── Environment guards ─────────────────────────────────────────────────────

if (IS_STUB && __DEV__) {
  console.warn(
    '[DaemonBridge] ⚠️  Running in STUB mode. ' +
    'Native daemon is NOT active (Simulator/Expo Go). ' +
    'Build a dev client with: npx expo run:ios / npx expo run:android'
  );
}

if (IS_STUB && !__DEV__) {
  // Production build without native module = fatal build configuration error.
  throw new Error(
    'DaemonBridge: Native module "SolnetNative" missing in production build. ' +
    'This is a build configuration error. The Rust core library ' +
    '(libsolnet_native.a / libsolnet_native.so) must be linked into the ' +
    'native project and exported as SolnetNative.'
  );
}

// ─── Event Emitter ───────────────────────────────────────────────────────────

const emitter = _NativeModule ? DeviceEventEmitter : null;

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
   * Securely generate a new Ed25519 keypair using the Rust engine.
   * Requires session token auth (handled automatically in native).
   */
  async generateKeypair(): Promise<{ publicKey: string; secretKey: string }> {
    if (IS_STUB) throw new Error('Keygen unavailable in STUB mode');
    const result = await _NativeModule!.generateKeypair();
    return JSON.parse(result);
  },

  /**
   * Sign a message using the native Rust Ed25519 implementation.
   */
  async signTransaction(secretKey: string, message: string): Promise<string> {
    if (IS_STUB) throw new Error('Signing unavailable in STUB mode');
    return _NativeModule!.signTransaction(secretKey, message);
  },

  /**
   * Get random bytes from the OS-backed Rust randomness engine.
   */
  async getRandomBytes(length: number): Promise<string> {
    if (IS_STUB) return '00'.repeat(length);
    return _NativeModule!.getRandomBytes(length);
  },

  /**
   * Tell the Rust daemon which power mode to operate in.
   * Map the string types to the integer codes expected by Rust (0, 1, 2).
   */
  async setThrottleState(state: ThrottleState): Promise<void> {
    if (IS_STUB) return;
    const map: Record<ThrottleState, number> = {
      FULL_POWER: 0,
      CONSERVE: 1,
      STANDBY: 2,
    };
    return _NativeModule!.setThrottleState(map[state]);
  },

  /**
   * Fetch runtime stats from the Rust relay client.
   * Returns stub stats with `isStub: true` when the module is unavailable.
   */
  async getStats(): Promise<DaemonStats> {
    if (IS_STUB) return STUB_STATS;

    const raw = await _NativeModule!.getDaemonStats();
    return {
      requests_served: raw.requests_served ?? 0,
      earnings_lamports: raw.earnings_lamports ?? 0,
      uptime_seconds: raw.uptime_seconds ?? 0,
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
