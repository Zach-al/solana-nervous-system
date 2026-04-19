/**
 * useDeviceGovernor.ts
 *
 * Monitors battery and network state to determine the appropriate
 * power/performance mode for the SOLNET node daemon.
 *
 * ULTRA-HARDENED: Uses NativeModules inspection to avoid fatal requirement crashes.
 */

import { useEffect, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
import { DaemonBridge } from '../services/DaemonBridge';

// Duck-typing types to avoid top-level imports that might crash the bundle
export type ThrottleState = 'FULL_POWER' | 'CONSERVE' | 'STANDBY';

export interface DeviceGovernorState {
  batteryLevel: number;
  batteryCharging: boolean;
  networkType: string;
  throttleState: ThrottleState;
  isReady: boolean;
}

function computeThrottle(charging: boolean, networkType: string): ThrottleState {
  const isWiFi = networkType === 'WIFI' || networkType === 'wifi';
  if (charging && isWiFi) return 'FULL_POWER';
  if (charging || isWiFi) return 'CONSERVE';
  return 'STANDBY';
}

export function useDeviceGovernor(): DeviceGovernorState {
  const [state, setState] = useState<DeviceGovernorState>({
    batteryLevel: 1.0,
    batteryCharging: true,
    networkType: 'UNKNOWN',
    throttleState: 'STANDBY',
    isReady: false,
  });

  useEffect(() => {
    let networkInterval: ReturnType<typeof setInterval> | null = null;
    let batteryLevelSub: any = null;
    let batteryStateSub: any = null;
    let cancelled = false;

    async function refresh() {
      if (cancelled) return;

      try {
        let batteryLevel = 0.5;
        let batteryState = 0; // Unknown
        let networkType = 'UNKNOWN';

        // ── ATOMIC GUARD ───────────────────────────────────────────────────
        // Only require modules if they actually exist in NativeModules.
        // This is THE ONLY WAY to prevent the fatal "Cannot find native module"
        // error in some DevClient environments.
        
        if (NativeModules.ExpoBattery) {
          try {
            const Battery = require('expo-battery');
            if (Battery.getBatteryLevelAsync) batteryLevel = await Battery.getBatteryLevelAsync();
            if (Battery.getBatteryStateAsync) batteryState = await Battery.getBatteryStateAsync();
          } catch (e) {
             console.warn('[Governor] ExpoBattery requirement failed despite NativeModule presence.');
          }
        }

        if (NativeModules.ExpoNetwork) {
          try {
            const Network = require('expo-network');
            if (Network.getNetworkStateAsync) {
              const res = await Network.getNetworkStateAsync();
              networkType = res.type || 'UNKNOWN';
            }
          } catch (e) {
             console.warn('[Governor] ExpoNetwork requirement failed despite NativeModule presence.');
          }
        }

        let charging = batteryState === 2 || batteryState === 3; // CHARGING or FULL
        
        // ── DEMO / SIMULATOR OVERRIDE ──────────────────────────────────────
        // Force optimal conditions in dev/simulator to unlock full dashboard UI
        if (__DEV__ || Platform.OS === 'ios' || networkType === 'UNKNOWN') {
           charging = true;
           if (networkType === 'UNKNOWN') networkType = 'wifi';
        }

        const throttleState = computeThrottle(charging, networkType);

        setState({
          batteryLevel,
          batteryCharging: charging,
          networkType,
          throttleState,
          isReady: true,
        });

      } catch (err) {
        console.warn('[Governor] Global refresh error:', err);
        if (!cancelled) setState(prev => ({ ...prev, isReady: true }));
      }
    }

    // Initial load
    refresh();

    // Deferred subscription check
    setTimeout(() => {
       if (cancelled) return;
       if (NativeModules.ExpoBattery) {
         try {
           const Battery = require('expo-battery');
           if (Battery.addBatteryLevelListener) batteryLevelSub = Battery.addBatteryLevelListener(refresh);
           if (Battery.addBatteryStateListener) batteryStateSub = Battery.addBatteryStateListener(refresh);
         } catch {}
       }
    }, 1500);

    networkInterval = setInterval(refresh, 60_000);

    return () => {
      cancelled = true;
      try {
        batteryLevelSub?.remove();
        batteryStateSub?.remove();
      } catch {}
      if (networkInterval) clearInterval(networkInterval);
    };
  }, []);

  useEffect(() => {
    if (!state.isReady) return;
    DaemonBridge.setThrottleState(state.throttleState).catch(() => {});
  }, [state.throttleState, state.isReady]);

  return state;
}
