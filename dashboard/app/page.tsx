'use client';
import dynamic from 'next/dynamic';
import StatsPanel from '../components/StatsPanel';
import ActivityFeed from '../components/ActivityFeed';
import BatchHistory from '../components/BatchHistory';

// Load Globe dynamically to avoid SSR issues with Three.js
const Globe = dynamic(() => import('../components/Globe'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--green-dim)',
        fontSize: 12,
        letterSpacing: '0.2em',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ fontSize: 32 }}>🧠</div>
      <div>INITIALIZING MESH...</div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <h1 className="header-logo">
          SNS{' '}
          <span>// SOLANA NERVOUS SYSTEM</span>
        </h1>
        <div className="header-meta">
          <span>DEVNET</span>
          <span className="header-badge">▶ LIVE</span>
          <span>v0.3.0</span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--green-primary)',
              display: 'inline-block',
              boxShadow: '0 0 6px var(--green-primary)',
              animation: 'glow-pulse 2s ease-in-out infinite',
            }}
          />
        </div>
      </header>

      {/* Body: sidebar | globe | sidebar */}
      <div className="dashboard-body">
        <StatsPanel />
        <div className="globe-container">
          <Globe />
          
          <BatchHistory />

          {/* Overlay labels on globe */}
          <div
            style={{
              position: 'absolute',
              bottom: 200,
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.25em',
                color: 'rgba(0,255,136,0.4)',
              }}
            >
              DRAG TO ROTATE · SCROLL TO ZOOM
            </div>
          </div>

          {/* Corner decorations */}
          <div className="corner-decoration corner-tl">
            <div
              style={{
                fontSize: 9,
                letterSpacing: '0.15em',
                color: 'rgba(0,255,136,0.3)',
                lineHeight: 1.8,
              }}
            >
              <div>◉ NODE ACTIVE</div>
              <div>⬡ MESH ONLINE</div>
              <div>◈ ZK BATCHING</div>
            </div>
          </div>
          <div className="corner-decoration corner-tr">
            <div
              style={{
                fontSize: 9,
                letterSpacing: '0.15em',
                color: 'rgba(153,69,255,0.5)',
                lineHeight: 1.8,
              }}
            >
              <div>12 CITIES</div>
              <div>2,341 NODES</div>
              <div>ZK AGGREGATION</div>
            </div>
          </div>
        </div>
        <ActivityFeed />
      </div>
    </main>
  );
}

