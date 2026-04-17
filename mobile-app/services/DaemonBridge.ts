/**
 * DaemonBridge.ts
 *
 * TypeScript bridge to the SolnetDaemon native module.
 * On iOS this calls Rust FFI via Swift.
 * On Android this calls Rust FFI via Kotlin/JNI.
 *
 * When the native module is unavailable (Expo Go, web), all methods
 * fall back gracefully so the app stays functional without a binary.
 */

import { NativeModules, NativeEventEmitter, Platform, EmitterSubscription } from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ThrottleState = 'FULL_POWER' | 'CONSERVE' | 'STANDBY';

export interface DaemonStats {
  requests_served: number;
  connections: number;
  uptime_secs: number;
  throttle_state: ThrottleState;
}

// ─── Native Module Interface ─────────────────────────────────────────────────

interface SolnetDaemonNative {
  setThrottleState(state: ThrottleState): Promise<void>;
  startDaemon(): Promise<void>;
  stopDaemon(): Promise<void>;
  getDaemonStats(): Promise<DaemonStats>;
}

// ─── Module Resolution ───────────────────────────────────────────────────────

const { SolnetDaemon: _NativeModule } = NativeModules as {
  SolnetDaemon: SolnetDaemonNative | undefined;
};

const isAvailable = !!_NativeModule;

if (!isAvailable) {
  console.warn(
    '[DaemonBridge] SolnetDaemon native module not found. ' +
    'Running in stub mode (Expo Go / simulator). ' +
    'Build with `expo run:ios` or `expo run:android` for full functionality.'
  );
}

// ─── Event Emitter ───────────────────────────────────────────────────────────

const emitter = isAvailable
  ? new NativeEventEmitter(_NativeModule as any)
  : null;

// ─── Public API ──────────────────────────────────────────────────────────────

export const DaemonBridge = {
  /** Whether the native Rust daemon module is present in this build. */
  isAvailable,

  /**
   * Tell the Rust daemon which power mode to operate in.
   * FULL_POWER → 50 concurrent connections, 10s heartbeat
   * CONSERVE   → 10 concurrent connections, 60s heartbeat
   * STANDBY    → 2 concurrent connections, 300s heartbeat
   */
  async setThrottleState(state: ThrottleState): Promise<void> {
    if (!_NativeModule) return;
    return _NativeModule.setThrottleState(state);
  },

  /** Start the Rust daemon in a background thread. */
  async start(): Promise<void> {
    if (!_NativeModule) return;
    return _NativeModule.startDaemon();
  },

  /** Gracefully stop the Rust daemon. */
  async stop(): Promise<void> {
    if (!_NativeModule) return;
    return _NativeModule.stopDaemon();
  },

  /**
   * Fetch runtime stats from the Rust daemon.
   * Returns zeroed stats when the module is unavailable.
   */
  async getStats(): Promise<DaemonStats> {
    if (!_NativeModule) {
      return {
        requests_served: 0,
        connections: 0,
        uptime_secs: 0,
        throttle_state: 'STANDBY',
      };
    }
    return _NativeModule.getDaemonStats();
  },

  /**
   * Subscribe to throttle state change events emitted by Rust.
   * Returns a subscription object; call `.remove()` to unsubscribe.
   */
  onThrottleStateChange(
    callback: (newState: ThrottleState) => void
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('DaemonThrottleChanged', callback);
  },

  /**
   * Subscribe to raw daemon log events emitted by Rust.
   */
  onLogLine(
    callback: (line: string) => void
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('DaemonLogLine', callback);
  },
} as const;
