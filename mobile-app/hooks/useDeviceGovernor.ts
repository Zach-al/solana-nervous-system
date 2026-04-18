/**
 * useDeviceGovernor.ts
 *
 * Monitors battery and network state to determine the appropriate
 * power/performance mode for the SOLNET node daemon.
 *
 * ThrottleState mapping:
 *   FULL_POWER — Charging + WiFi      → max throughput
 *   CONSERVE   — Charging XOR WiFi    → reduced throughput
 *   STANDBY    — Unplugged + Cellular  → heartbeat only
 */

import { useEffect, useRef, useState } from 'react';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import { DaemonBridge } from '../services/DaemonBridge';

export type ThrottleState = 'FULL_POWER' | 'CONSERVE' | 'STANDBY';

export interface DeviceGovernorState {
  batteryLevel: number;           // 0.0 – 1.0
  batteryCharging: boolean;
  networkType: Network.NetworkStateType;
  throttleState: ThrottleState;
  isReady: boolean;               // false until first async read completes
}

function computeThrottle(
  charging: boolean,
  networkType: Network.NetworkStateType,
): ThrottleState {
  const isWiFi = networkType === Network.NetworkStateType.WIFI;

  if (charging && isWiFi) return 'FULL_POWER';
  if (charging || isWiFi) return 'CONSERVE';
  return 'STANDBY';
}

export function useDeviceGovernor(): DeviceGovernorState {
  const [state, setState] = useState<DeviceGovernorState>({
    batteryLevel: 1.0,
    batteryCharging: true,
    networkType: Network.NetworkStateType.UNKNOWN,
    throttleState: 'STANDBY',
    isReady: false,
  });

  // Keep a ref to avoid stale closure in subscriptions
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let networkInterval: ReturnType<typeof setInterval> | null = null;
    let batteryLevelSub: Battery.Subscription | null = null;
    let batteryStateSub: Battery.Subscription | null = null;
    let cancelled = false;

    async function refresh() {
      try {
        const [batteryLevel, batteryState, networkState] = await Promise.all([
          Battery.getBatteryLevelAsync(),
          Battery.getBatteryStateAsync(),
          Network.getNetworkStateAsync(),
        ]);

        if (cancelled) return;

        const charging =
          batteryState === Battery.BatteryState.CHARGING ||
          batteryState === Battery.BatteryState.FULL;

        const networkType = networkState.type ?? Network.NetworkStateType.UNKNOWN;
        const throttleState = computeThrottle(charging, networkType);

        setState({
          batteryLevel,
          batteryCharging: charging,
          networkType,
          throttleState,
          isReady: true,
        });
      } catch (err) {
        console.warn('[DeviceGovernor] Failed to read device state:', err);
        // On error, keep previous state but mark ready
        if (!cancelled) {
          setState(prev => ({ ...prev, isReady: true }));
        }
      }
    }

    // Initial read
    refresh();

    // Subscribe to battery level changes (fires when level crosses a threshold)
    batteryLevelSub = Battery.addBatteryLevelListener(() => refresh());

    // Subscribe to charging state changes (plug/unplug)
    batteryStateSub = Battery.addBatteryStateListener(() => refresh());

    // Poll network state every 30 s (no native subscription available)
    networkInterval = setInterval(refresh, 30_000);

    return () => {
      cancelled = true;
      batteryLevelSub?.remove();
      batteryStateSub?.remove();
      if (networkInterval) clearInterval(networkInterval);
    };
  }, []);

  // ── Sync throttle state to Rust governor via native bridge ─────────
  useEffect(() => {
    if (!state.isReady) return;

    // Fire-and-forget — governor sync is best-effort
    DaemonBridge.setThrottleState(state.throttleState).catch(() => {});
  }, [state.throttleState, state.isReady]);

  return state;
}

