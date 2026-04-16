const DEFAULT_BOOTSTRAP = 'https://solnet-production.up.railway.app';

export const BOOTSTRAP_PEERS = (function() {
  let peers: string[] = [DEFAULT_BOOTSTRAP, 'https://api.devnet.solana.com'];
  if (typeof process !== 'undefined' && process.env?.SOLNET_BOOTSTRAP_PEERS) {
    peers = process.env.SOLNET_BOOTSTRAP_PEERS.split(',');
  }
  if (typeof localStorage !== 'undefined' && localStorage.getItem('SOLNET_BOOTSTRAP_PEERS')) {
    peers = localStorage.getItem('SOLNET_BOOTSTRAP_PEERS')!.split(',');
  }
  return peers;
})();

export interface PeerHealth {
  url: string;
  latencyMs: number;
  alive: boolean;
  requestsServed: number;
}

export class PeerDiscovery {
  private peers: string[];
  private healthMap: Map<string, PeerHealth> = new Map();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(peers: string[] = [...BOOTSTRAP_PEERS]) {
    this.peers = peers;
  }

  async rankPeers(): Promise<string[]> {
    const results = await Promise.allSettled(
      this.peers.map(async (peer) => {
        const start = Date.now();
        try {
          const resp = await fetch(`${peer}/health`, {
            signal: AbortSignal.timeout(3000),
          });
          const latencyMs = Date.now() - start;
          const data = await resp.json();

          this.healthMap.set(peer, {
            url: peer,
            latencyMs,
            alive: resp.ok,
            requestsServed: data.requests_served || 0,
          });
          return { peer, latencyMs, alive: resp.ok };
        } catch {
          this.healthMap.set(peer, {
            url: peer,
            latencyMs: 99999,
            alive: false,
            requestsServed: 0,
          });
          return { peer, latencyMs: 99999, alive: false };
        }
      })
    );

    return results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value)
      .sort((a: any, b: any) => {
        if (a.alive && !b.alive) return -1;
        if (!a.alive && b.alive) return 1;
        return a.latencyMs - b.latencyMs;
      })
      .map((r: any) => r.peer);
  }

  startHealthChecks(onPeerDown?: (url: string) => void) {
    this.healthCheckInterval = setInterval(async () => {
      await this.rankPeers();
      this.healthMap.forEach((health, url) => {
        if (!health.alive && onPeerDown) {
          onPeerDown(url);
        }
      });
    }, 30000);
  }

  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  getBestPeer(): string {
    let best = this.peers[0];
    let bestLatency = Infinity;

    this.healthMap.forEach((health, url) => {
      if (health.alive && health.latencyMs < bestLatency) {
        bestLatency = health.latencyMs;
        best = url;
      }
    });

    return best;
  }

  getAllHealth(): PeerHealth[] {
    return Array.from(this.healthMap.values());
  }
}
