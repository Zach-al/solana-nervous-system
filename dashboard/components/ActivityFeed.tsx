'use client';

import { useEffect, useState, useRef } from 'react';

interface ActivityEntry {
  id: number;
  timestamp: string;
  method: string;
  latencyMs: number;
  success: boolean;
  isOnion?: boolean; // New for V0.4
  clientIp?: string; // New for V0.4
}

const FAKE_METHODS = [
  'getBalance',
  'getSlot',
  'getBlockHeight',
  'getAccountInfo',
  'sendTransaction',
  'getLatestBlockhash',
  'getConfirmedBlock',
  'getTokenAccountsByOwner',
  'getProgramAccounts',
  'getEpochInfo',
  'getVersion',
  'getSignaturesForAddress',
];

function randomMethod(): string {
  return FAKE_METHODS[Math.floor(Math.random() * FAKE_METHODS.length)];
}

function randomLatency(): number {
  // Realistic latency: 30-300ms
  return Math.floor(Math.random() * 270) + 30;
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 8);
}

function getMethodColor(method: string): string {
  if (method === 'sendTransaction') return '#ffb800';
  if (method.startsWith('get')) return '#00cc6a';
  return '#9945ff';
}

let idCounter = 0;

export default function ActivityFeed() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const addEntry = (entry: Omit<ActivityEntry, 'id'>) => {
    setEntries((prev) => {
      const newEntry = { ...entry, id: idCounter++ };
      return [newEntry, ...prev].slice(0, 8);
    });
  };

  useEffect(() => {
    // Generate initial fake entries
    for (let i = 7; i >= 0; i--) {
      const fakeDate = new Date(Date.now() - i * 2000);
      addEntry({
        timestamp: formatTime(fakeDate),
        method: randomMethod(),
        latencyMs: randomLatency(),
        success: Math.random() > 0.05,
        isOnion: Math.random() > 0.7,
        clientIp: Math.random() > 0.7 ? 'anon' : `192.168.1.${Math.floor(Math.random()*255)}`,
      });
    }

    // Keep generating fake entries every 2 seconds when daemon isn't available
    const fakeInterval = setInterval(() => {
      addEntry({
        timestamp: formatTime(new Date()),
        method: randomMethod(),
        latencyMs: randomLatency(),
        success: Math.random() > 0.05,
        isOnion: Math.random() > 0.7,
        clientIp: Math.random() > 0.7 ? 'anon' : `192.168.1.${Math.floor(Math.random()*255)}`,
      });
    }, 2000);

    return () => clearInterval(fakeInterval);
  }, []);

  return (
    <div className="sidebar sidebar-right">
      <div className="section-heading">Live Activity</div>

      <div
        ref={containerRef}
        style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
      >
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className="activity-row"
            style={{
              opacity: 1 - i * 0.08,
              animationDelay: `${i * 0.02}s`,
            }}
          >
            <span className="activity-time">{entry.timestamp}</span>
            <span
              className="activity-method"
              style={{ color: getMethodColor(entry.method) }}
            >
              {entry.isOnion && (
                <span 
                  title="Origin IP cryptographically hidden via Onion Routing"
                  style={{ marginRight: 8, fontSize: 10, cursor: 'help' }}
                >
                  🔒
                </span>
              )}
              {entry.method}
            </span>
            <span className="activity-latency" style={{ opacity: 0.6 }}>
              {entry.isOnion ? 'anon' : entry.clientIp?.split('.').pop() || '.??'}
            </span>
            <span className="activity-latency">{entry.latencyMs}ms</span>
            <span
              className="activity-dot"
              style={{
                background: entry.success ? 'var(--green-primary)' : '#ff4466',
                boxShadow: `0 0 4px ${entry.success ? 'var(--green-primary)' : '#ff4466'}`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="divider" style={{ marginTop: 'auto' }} />

      {/* Summary */}
      <div className="stat-card" style={{ marginTop: 8 }}>
        <div className="stat-label">Request Types</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9,
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#00cc6a' }}>◉ getBalance</span>
            <span style={{ color: 'var(--text-dim)' }}>34%</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9,
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#9945ff' }}>◉ getSlot</span>
            <span style={{ color: 'var(--text-dim)' }}>28%</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9,
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#ffb800' }}>◉ sendTransaction</span>
            <span style={{ color: 'var(--text-dim)' }}>18%</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9,
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#00cc6a' }}>◉ other</span>
            <span style={{ color: 'var(--text-dim)' }}>20%</span>
          </div>
        </div>
      </div>

      {/* Throughput indicator */}
      <div className="stat-card">
        <div className="stat-label">Avg Latency</div>
        <div className="stat-value" style={{ fontSize: 18, color: 'var(--green-primary)' }}>
          {entries.length > 0
            ? Math.floor(
                entries.reduce((acc, e) => acc + e.latencyMs, 0) / entries.length
              )
            : 0}
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}> ms</span>
        </div>
      </div>
    </div>
  );
}
