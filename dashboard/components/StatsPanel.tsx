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

export default function StatsPanel() {
  const [stats, setStats] = useState<NodeStats | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(false);
  const [prevRequests, setPrevRequests] = useState(0);
  const [flash, setFlash] = useState(false);
  const uptime = useRef(0);
  const [uptimeDisplay, setUptimeDisplay] = useState('00:00:00');

  const fetchStats = useCallback(async () => {
    try {
      const res = await secureFetch('/api/daemon/stats');
      if (!res.ok) throw new Error('bad status');
      const data: NodeStats = await res.json();
      setStats(data);
      setConnecting(false);
      setError(false);

      if (data.requests_served > prevRequests) {
        setFlash(true);
        setTimeout(() => setFlash(false), 500);
      }
      setPrevRequests(data.requests_served);
      uptime.current = data.uptime_seconds;
    } catch {
      setConnecting(true);
      setError(true);
    }
  }, [prevRequests]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      {/* Node Identity */}
      <div className="metric-block">
        <div className="metric-label">NODE IDENTITY</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div className="metric-value" style={{ fontSize: '14px', color: error ? '#ef4444' : 'inherit' }}>
            {error ? 'OFFLINE' : (stats?.node_name ?? 'SNS_PRIMARY')}
          </div>
          <div className="status-online">
            <span className="status-dot" style={{ background: error ? '#ef4444' : (connecting ? 'var(--amber)' : 'var(--neon-green)') }} />
            {error ? 'DISCONNECTED' : (connecting ? 'CONNECTING' : 'ONLINE')}
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-technical)', fontSize: '10px', color: 'var(--text-dim)', wordBreak: 'break-all' }}>
          ID: {error ? 'NODE_UNREACHABLE' : (stats?.node_id ?? 'IDENTITY_INITIALIZING')}
        </div>
      </div>

      <div className="metric-block">
        <div className="metric-label">UPTIME_METRIC</div>
        <div className="metric-value">{uptimeDisplay}</div>
      </div>

      <div className="metric-block">
        <div className="metric-label">REQUESTS_PROXIED</div>
        <div className="metric-value" style={{ color: flash ? 'var(--electric-purple)' : 'inherit', transition: 'color 0.2s' }}>
          {stats ? stats.requests_served.toLocaleString() : '---'}
        </div>
      </div>

      <div className="metric-block">
        <div className="metric-label">PEER_STRENGTH</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="metric-value">{stats?.peer_count ?? 0}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
            ACTIVE P2P CHANNELS
          </div>
        </div>
      </div>

      {/* Embedded components also cleaned up via styles */}
      <PrivacyPanel />
    </div>
  );
}
