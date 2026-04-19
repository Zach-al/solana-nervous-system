/**
 * DaemonBridge.ts
 *
 * TypeScript bridge to the SolnetDaemon native module.
 * 
 * HARDENED: Includes a robust simulation mode for dev/simulator environments.
 */

import { NativeModules, DeviceEventEmitter, EmitterSubscription } from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ThrottleState = 'FULL_POWER' | 'CONSERVE' | 'STANDBY';

export interface RelayConfig {
  relay_url: string;
  wallet_pubkey: string;
  node_name?: string;
  max_concurrent?: number;
  lamports_per_request?: number;
}

export interface DaemonStats {
  requests_served: number;
  earnings_lamports: number;
  uptime_seconds: number;
  governor_state: number;
  is_running: boolean;
  peer_count: number;
  isStub: boolean;
}

interface SolnetNativeInterface {
  generateKeypair(): Promise<string>;
  getRandomBytes(length: number): Promise<string>;
  signTransaction(secretKey: string, message: string): Promise<string>;
  startRelay(configJson: string): Promise<boolean>;
  stopRelay(): Promise<boolean>;
  getDaemonStats(): Promise<Record<string, any>>;
  setThrottleState(state: number): Promise<void>;
  getThrottleState(): Promise<number>;
  initP2PNode(enableMdns: boolean): Promise<string>;
  connectPeer(multiaddr: String): Promise<boolean>;
  getPeerCount(): Promise<number>;
}

// ─── Module Resolution ───────────────────────────────────────────────────────

const _NativeModule = (NativeModules.SolnetNative || NativeModules.SolnetDaemon) as 
  SolnetNativeInterface | undefined;

const IS_STUB = !_NativeModule;
const emitter = DeviceEventEmitter;

// ─── Simulation State ────────────────────────────────────────────────────────

let simulationRunning = false;
let simulationInterval: any = null;
let simulatedStats: DaemonStats = {
  requests_served: 0,
  earnings_lamports: 0,
  uptime_seconds: 0,
  governor_state: 0,
  is_running: false,
  peer_count: 0,
  isStub: true,
};

const MOCK_LOGS = [
  'initializing p2p stack...',
  'advertising node on dht...',
  'found peer: 12D3KooW...',
  'routing request: getAccountInfo',
  'served batch: 124 txs',
  'settled rewards: 50 lamports',
  'ping: 42ms to SGP-1',
];

function startSimulation() {
  if (simulationRunning) return;
  simulationRunning = true;
  simulatedStats.is_running = true;
  console.log('✅ [DaemonBridge] Simulation started.');

  simulationInterval = setInterval(() => {
    // Increment stats
    simulatedStats.requests_served += Math.floor(Math.random() * 5);
    simulatedStats.earnings_lamports += Math.floor(Math.random() * 100);
    simulatedStats.uptime_seconds += 2;
    simulatedStats.peer_count = 12 + Math.floor(Math.random() * 4);

    // Emit mock log
    const log = MOCK_LOGS[Math.floor(Math.random() * MOCK_LOGS.length)];
    emitter.emit('DaemonLogLine', `[SIM] ${log}`);
  }, 2000);
}

function stopSimulation() {
  simulationRunning = false;
  simulatedStats.is_running = false;
  if (simulationInterval) clearInterval(simulationInterval);
  console.log('🛑 [DaemonBridge] Simulation stopped.');
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const DaemonBridge = {
  isAvailable: !IS_STUB,
  isStub: IS_STUB,

  async start(config: RelayConfig): Promise<{ ok: boolean; isStub: boolean }> {
    if (IS_STUB) {
      startSimulation();
      return { ok: true, isStub: true };
    }
    
    if (!config.relay_url || !config.wallet_pubkey) {
      console.warn('[DaemonBridge] Missing relay_url or wallet_pubkey');
      return { ok: false, isStub: false };
    }

    // ─── VALIDATION GUARD ──────────────────────────────────────────
    // The Rust relay strictly requires a Base58 address (32-44 chars).
    // Hex addresses (64 chars) will trigger "Invalid Config JSON".
    const pubkey = config.wallet_pubkey;
    if (pubkey.length < 32 || pubkey.length > 44) {
      console.error(`[DaemonBridge] INVALID PUBKEY FORMAT: "${pubkey}". Must be Base58 (32-44 chars).`);
      return { ok: false, isStub: false };
    }

    try {
      // ─── RIGID PAYLOAD MAPPING ──────────────────────────────────────────
      // Rust expects a strict JSON structure. "Serde" will fail on Android if 
      // optional fields are missing or typed as 'undefined'.
      const rigidPayload = {
        relay_url: config.relay_url,
        wallet_pubkey: config.wallet_pubkey,
        node_name: config.node_name || "solnet-node",
        max_concurrent: config.max_concurrent || 32,
        lamports_per_request: config.lamports_per_request || 5,
        version: "1.0.0"
      };

      const json = JSON.stringify(rigidPayload);
      console.log('[DaemonBridge] OUTGOING CONFIG:', json);

      const result = await _NativeModule!.startRelay(json);
      return { ok: result, isStub: false };
    } catch (err) {
      console.error('[DaemonBridge] startRelay execution failed:', err);
      return { ok: false, isStub: false };
    }
  },

  async stop(): Promise<{ ok: boolean; isStub: boolean }> {
    if (IS_STUB) {
      stopSimulation();
      return { ok: true, isStub: true };
    }
    const result = await _NativeModule!.stopRelay();
    return { ok: result, isStub: false };
  },

  async generateKeypair(): Promise<{ publicKey: string; secretKey: string }> {
    if (IS_STUB) throw new Error('Keygen unavailable in STUB mode');
    const result = await _NativeModule!.generateKeypair();
    return JSON.parse(result);
  },

  async signTransaction(secretKey: string, message: string): Promise<string> {
    if (IS_STUB) throw new Error('Signing unavailable in STUB mode');
    return _NativeModule!.signTransaction(secretKey, message);
  },

  async getRandomBytes(length: number): Promise<string> {
    if (IS_STUB) return '00'.repeat(length);
    return _NativeModule!.getRandomBytes(length);
  },

  async setThrottleState(state: ThrottleState): Promise<void> {
    if (IS_STUB) {
      const mapVal: Record<ThrottleState, number> = { FULL_POWER: 0, CONSERVE: 1, STANDBY: 2 };
      simulatedStats.governor_state = mapVal[state];
      return;
    }
    const map: Record<ThrottleState, number> = {
      FULL_POWER: 0,
      CONSERVE: 1,
      STANDBY: 2,
    };
    return _NativeModule!.setThrottleState(map[state]);
  },

  async getStats(): Promise<DaemonStats> {
    if (IS_STUB) return { ...simulatedStats };
    try {
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
    } catch (e) {
      return { ...simulatedStats, isStub: true, is_running: false };
    }
  },

  onThrottleStateChange(callback: (newState: ThrottleState) => void): EmitterSubscription | null {
    return DeviceEventEmitter.addListener('DaemonThrottleChanged', callback);
  },

  onLogLine(callback: (line: string) => void): EmitterSubscription | null {
    return DeviceEventEmitter.addListener('DaemonLogLine', callback);
  },

  async initP2PNode(enableMdns: boolean = false): Promise<{ status: string; peer_id?: string; message?: string }> {
    if (IS_STUB) return { status: 'running', peer_id: 'sns-stub-peer-id' };
    const result = await _NativeModule!.initP2PNode(enableMdns);
    return JSON.parse(result);
  },

  async dialPeer(multiaddr: string): Promise<boolean> {
    if (IS_STUB) return true;
    return await _NativeModule!.connectPeer(multiaddr);
  },

  async getPeerCount(): Promise<number> {
    if (IS_STUB) return simulatedStats.peer_count;
    return await _NativeModule!.getPeerCount();
  },

  async pauseForWallet(): Promise<void> {
    if (IS_STUB) return;
    try { await _NativeModule!.setThrottleState(2); } catch {}
    await new Promise<void>(resolve => setTimeout(resolve, 600));
  },

  async resumeAfterWallet(): Promise<void> {
    if (IS_STUB) return;
    try { await _NativeModule!.setThrottleState(0); } catch {}
  },
} as const;
