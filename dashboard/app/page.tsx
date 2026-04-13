'use client';
import dynamic from 'next/dynamic';
import StatsPanel from '../components/StatsPanel';
import ActivityFeed from '../components/ActivityFeed';
import BatchHistory from '../components/BatchHistory';
import { useEffect, useState } from 'react';

// Load Globe dynamically to avoid SSR issues with Three.js
const Globe = dynamic(() => import('../components/Globe'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg-primary)',
      }}
    />
  ),
});

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return mobile;
}

export default function Home() {
  const isMobile = useIsMobile();

  return (
    <main className="dashboard-container">
      {/* Globe as FULL background — not a widget */}
      {!isMobile && (
        <div className="globe-background">
          <Globe />
        </div>
      )}

      {/* Header */}
      <header className="dashboard-header">
        <h1 className="header-logo">
          SOLNET{' '}
          <span>// DECENTRALIZED RPC</span>
        </h1>
        <div className="header-meta">
          <span>DEVNET</span>
          <span className="header-badge">▶ LIVE</span>
          <span>v1.0.0</span>
          <span className="live-indicator" />
        </div>
      </header>

      {/* Body: sidebar | center | sidebar — glassmorphism panels */}
      <div className="dashboard-body">
        <StatsPanel />
        <div className="center-area">
          {/* Mobile-only static globe replacement */}
          {isMobile && (
            <div className="mobile-globe-placeholder">
              <div className="mobile-globe-text">🌐</div>
              <div className="mobile-globe-sub">GLOBAL MESH ACTIVE</div>
            </div>
          )}
          <BatchHistory />
        </div>
        <ActivityFeed />
      </div>
    </main>
  );
}
