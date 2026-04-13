'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { secureFetch } from '../lib/secure-fetch';
import EarningsPanel from './EarningsPanel';
import PrivacyPanel from './PrivacyPanel';

interface NodeStats {
  node_id: string;
  node_name: string;
  requests_served: number;
  earnings_lamports: number;
  earnings_sol: number;
  uptime_seconds: number;
  peer_count: number;
  status: string;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// formatEarnings utility removed in favor of EarningsPanel


function useAnimatedValue(value: number, duration: number = 1000): number {
  const [current, setCurrent] = useState(value);
  
  useEffect(() => {
    if (value === current) return;
    const startValue = current;
    const endValue = value;
    const startTime = performance.now();
    
    let req: number;
    const step = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCurrent(startValue + (endValue - startValue) * ease);
      
      if (progress < 1) {
        req = requestAnimationFrame(step);
      }
    };
    req = requestAnimationFrame(step);
    
    return () => cancelAnimationFrame(req);
  }, [value, current, duration]);
  
  return current;
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  flash?: boolean;
  className?: string;
}

function StatCard({ label, sub, value, flash, className }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${className || ''} ${flash ? 'counter-flash' : ''}`}>
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function StatsPanel() {
  const [stats, setStats] = useState<NodeStats | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [prevRequests, setPrevRequests] = useState(0);
  const [flash, setFlash] = useState(false);
  const earningsBarRef = useRef<HTMLDivElement>(null);
  const uptime = useRef(0);
  const [uptimeDisplay, setUptimeDisplay] = useState('00:00:00');

  const fetchStats = useCallback(async () => {
    try {
      const nodeUrl =
        process.env.NEXT_PUBLIC_NODE_URL || 'https://solnet-production.up.railway.app';
      const res = await secureFetch(`${nodeUrl}/stats`);
      if (!res.ok) throw new Error('bad status');
      const data: NodeStats = await res.json();
      setStats(data);
      setConnecting(false);

      if (data.requests_served > prevRequests) {
        setFlash(true);
        setTimeout(() => setFlash(false), 500);
      }
      setPrevRequests(data.requests_served);
      uptime.current = data.uptime_seconds;
    } catch {
      setConnecting(true);
    }
  }, [prevRequests]);

  // Tick uptime locally every second for smooth display
  useEffect(() => {
    const tick = setInterval(() => {
      uptime.current += 1;
      setUptimeDisplay(formatUptime(uptime.current));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const earningsSol = stats ? stats.earnings_sol : 0;
  const animatedEarningsSol = useAnimatedValue(earningsSol, 1000);
  const earningsBarWidth = Math.min(100, (earningsSol / 0.001) * 100);

  return (
    <div className="sidebar">
      <div className="section-heading">Node Status</div>

      {/* Online / Connecting indicator */}
      <div className="stat-card">
        <div className="stat-label">Connection</div>
        <div className="status-row">
          <span className={`status-dot ${connecting ? 'amber' : ''}`} />
          <span
            style={{
              color: connecting ? 'var(--amber)' : 'var(--green-primary)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            {connecting ? 'CONNECTING...' : 'ONLINE'}
          </span>
        </div>
        {stats && (
          <div className="stat-sub" style={{ marginTop: 6 }}>
            ID: {stats.node_id.slice(0, 12)}…
          </div>
        )}
      </div>

      {/* Requests Served */}
      <StatCard
        label="Requests Served"
        value={stats ? stats.requests_served.toLocaleString() : '—'}
        flash={flash}
        sub="total proxied RPC calls"
      />

      {/* Earnings Panel [V0.3] */}
      <EarningsPanel />

      {/* Privacy Shield [V0.4] */}
      <PrivacyPanel />



      {/* Uptime */}
      <StatCard
        label="Uptime"
        value={uptimeDisplay}
        sub="HH:MM:SS continuous"
        className="large"
      />

      <div className="divider" />
      <div className="section-heading">Network</div>

      {/* Network stats grid */}
      <div className="network-grid">
        <div className="network-item">
          <div className="value">847</div>
          <div className="label">PEERS</div>
        </div>
        <div className="network-item">
          <div className="value">2,341</div>
          <div className="label">GLOBAL NODES</div>
        </div>
      </div>

      {/* Peer count from daemon */}
      {stats && stats.peer_count > 0 && (
        <StatCard
          label="Connected Peers"
          value={stats.peer_count}
          sub="direct P2P connections"
        />
      )}

      <div className="divider" />
      <div className="section-heading">Configuration</div>

      <div className="stat-card">
        <div className="stat-label">Node Name</div>
        <div className="stat-value" style={{ fontSize: 12, color: 'var(--text-primary)' }}>
          {stats?.node_name ?? 'sns-node-1'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Network</div>
        <div className="stat-value" style={{ fontSize: 11, color: 'var(--green-dim)' }}>
          DEVNET
        </div>
      </div>
    </div>
  );
}
