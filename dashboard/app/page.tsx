'use client';

import dynamic from 'next/dynamic';
import StatsPanel from '../components/StatsPanel';
import PerformancePanel from '../components/PerformancePanel';
import WalletPanel from '../components/WalletPanel';
import BatchHistory from '../components/BatchHistory';
import MobileNodePanel from '../components/MobileNodePanel';
import EarningsPanel from '../components/EarningsPanel';
import ActivityFeed from '../components/ActivityFeed';
import { useEffect, useState } from 'react';

// Load Globe dynamically to avoid SSR issues with Three.js
const Globe = dynamic(() => import('../components/Globe'), {
  ssr: false,
  loading: () => <div className="globe-mount" />,
});

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <main className="dashboard-container">
      <div className="globe-mount">
        <Globe />
      </div>

      {/* Header */}
      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <h1 className="header-logo" style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '0.15em' }}>
            SOLNET <span style={{ color: 'var(--text-dim)', fontSize: '10px', fontWeight: 400 }}>// DECENTRALIZED INFRASTRUCTURE</span>
          </h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div className="status-online">
            <span className="status-dot" />
            LIVE NETWORKS
          </div>
          <div style={{ fontFamily: 'var(--font-technical)', fontSize: '11px', color: 'var(--text-dim)' }}>
            v2.1.0-STITCH
          </div>
        </div>
      </header>

      {/* Main Grid Architecture */}
      <div className="dashboard-grid">
        
        {/* Left Column: Local Infrastructure & Health */}
        <section className="panel-stitch">
          <div className="panel-header">
            INFRASTRUCTURE <span>[HEALTH]</span>
          </div>
          <div className="panel-content">
            <StatsPanel />
            <ActivityFeed />
          </div>
        </section>

        {/* Center Column: Core Engine & Settlements */}
        <section className="panel-stitch" style={{ flex: 1 }}>
          <div className="panel-header">
            CENTRAL ROUTING ENGINE <span>[ENGINE_CORE]</span>
          </div>
          <div className="panel-content">
            <PerformancePanel />
            <EarningsPanel />
            <BatchHistory />
          </div>
        </section>

        {/* Right Column: Fleet Management & Economy */}
        <section className="panel-stitch">
          <div className="panel-header">
            FLEET & ECONOMY <span>[FLEET_COORD]</span>
          </div>
          <div className="panel-content">
            <WalletPanel />
            <MobileNodePanel />
          </div>
        </section>

      </div>
    </main>
  );
}
