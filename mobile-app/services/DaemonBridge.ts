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
 */

import { NativeModules, NativeEventEmitter, Platform, EmitterSubscription } from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ThrottleState = 'FULL_POWER' | 'CONSERVE' | 'STANDBY';

export interface DaemonStats {
  requests_served: number;
  connections: number;
  uptime_secs: number;
  throttle_state: ThrottleState;
  /** True when the native module is absent and stats are simulated. */
  isStub: boolean;
}

// ─── Native Module Interface ─────────────────────────────────────────────────

interface SolnetDaemonNative {
  setThrottleState(state: ThrottleState): Promise<void>;
  startDaemon(): Promise<void>;
  stopDaemon(): Promise<void>;
  getDaemonStats(): Promise<Omit<DaemonStats, 'isStub'>>;
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

// ─── Public API ──────────────────────────────────────────────────────────────

export const DaemonBridge = {
  /** Whether the native Rust daemon module is present in this build. */
  isAvailable: !IS_STUB,

  /** True when running without the native module (Expo Go / dev). */
  isStub: IS_STUB,

  /**
   * Tell the Rust daemon which power mode to operate in.
   * In authenticated mode (iOS/Android), this uses a session token.
   * In stub mode, this is a no-op.
   */
  async setThrottleState(state: ThrottleState): Promise<void> {
    if (IS_STUB) return;
    return _NativeModule!.setThrottleState(state);
  },

  /** Start the Rust daemon in a background thread. */
  async start(): Promise<void> {
    if (IS_STUB) return;
    return _NativeModule!.startDaemon();
  },

  /** Gracefully stop the Rust daemon. */
  async stop(): Promise<void> {
    if (IS_STUB) return;
    return _NativeModule!.stopDaemon();
  },

  /**
   * Fetch runtime stats from the Rust daemon.
   * Returns stub stats with `isStub: true` when the module is unavailable.
   * Callers should check `isStub` and show a "DEMO MODE" indicator.
   */
  async getStats(): Promise<DaemonStats> {
    if (IS_STUB) {
      return {
        requests_served: 0,
        connections: 0,
        uptime_secs: 0,
        throttle_state: 'STANDBY',
        isStub: true,
      };
    }
    const raw = await _NativeModule!.getDaemonStats();
    return { ...raw, isStub: false };
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
