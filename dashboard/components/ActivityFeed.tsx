'use client';

import { useEffect, useState, useRef } from 'react';

interface ActivityEntry {
  id: number;
  timestamp: string;
  method: string;
  latencyMs: number;
  success: boolean;
  isOnion?: boolean;
  clientIp?: string;
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
  return Math.floor(Math.random() * 270) + 30;
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 8);
}

function getMethodColor(method: string): string {
  if (method === 'sendTransaction') return 'var(--amber)';
  if (method.startsWith('get')) return 'var(--neon-green)';
  return 'var(--electric-purple)';
}

let idCounter = 0;

export default function ActivityFeed() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  const addEntry = (entry: Omit<ActivityEntry, 'id'>) => {
    setEntries((prev) => {
      const newEntry = { ...entry, id: idCounter++ };
      return [newEntry, ...prev].slice(0, 8);
    });
  };

  useEffect(() => {
    for (let i = 7; i >= 0; i--) {
      const fakeDate = new Date(Date.now() - i * 2000);
      addEntry({
        timestamp: formatTime(fakeDate),
        method: randomMethod(),
        latencyMs: randomLatency(),
        success: Math.random() > 0.05,
        isOnion: Math.random() > 0.7,
        clientIp: Math.random() > 0.7 ? '0.0.0.0' : `192.168.1.${Math.floor(Math.random()*255)}`,
      });
    }

    const fakeInterval = setInterval(() => {
      addEntry({
        timestamp: formatTime(new Date()),
        method: randomMethod(),
        latencyMs: randomLatency(),
        success: Math.random() > 0.05,
        isOnion: Math.random() > 0.7,
        clientIp: Math.random() > 0.7 ? '0.0.0.0' : `192.168.1.${Math.floor(Math.random()*255)}`,
      });
    }, 2000);

    return () => clearInterval(fakeInterval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
      <div className="panel-header" style={{ borderBottom: 'none', padding: '0 0 8px 0' }}>
        INGRESS_LOGS <span>[LIVE_FEED]</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border-main)', border: '1px solid var(--border-main)' }}>
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 1fr 60px 10px',
              gap: '12px',
              alignItems: 'center',
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              opacity: 1 - i * 0.1,
              fontFamily: 'var(--font-technical)',
              fontSize: '10px'
            }}
          >
            <span style={{ color: 'var(--text-dim)' }}>{entry.timestamp}</span>
            <span style={{ color: getMethodColor(entry.method), fontWeight: 700 }}>
              {entry.isOnion && (
                <span style={{ color: 'var(--electric-purple)', marginRight: '6px' }}>[O]</span>
              )}
              {entry.method.toUpperCase()}
            </span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--bright-white)', fontWeight: 700 }}>{entry.latencyMs}ms</div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)' }}>{entry.clientIp === '0.0.0.0' ? 'ANON' : 'DECENTRAL'}</div>
            </div>
            <div style={{ 
              width: '4px', 
              height: '4px', 
              background: entry.success ? 'var(--neon-green)' : '#ff4466',
              boxShadow: `0 0 6px ${entry.success ? 'var(--neon-green)' : '#ff4466'}`
            }} />
          </div>
        ))}
      </div>

      <div className="metric-block">
        <div className="metric-label">NETWORK_DISTRIBUTION</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
          {[
            { label: 'GET_BALANCE', color: 'var(--neon-green)', pct: '34%' },
            { label: 'GET_SLOT', color: 'var(--electric-purple)', pct: '28%' },
            { label: 'SEND_TX', color: 'var(--amber)', pct: '18%' }
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-technical)' }}>
              <span style={{ color: item.color }}>{item.label}</span>
              <span style={{ color: 'var(--text-dim)' }}>{item.pct}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
