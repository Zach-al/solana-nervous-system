'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const Globe = dynamic(() => import('../../components/Globe'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', background: '#050505' }} />
  ),
});

interface LiveStats {
  requests_served: number;
  earnings_sol: number;
  uptime_seconds: number;
  status: string;
}

function useLiveStats() {
  const [stats, setStats] = useState<LiveStats | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('https://solnet-production.up.railway.app/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Silent — landing page degrades gracefully
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return stats;
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = display;
    const end = value;
    const duration = 1200;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * ease));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <>{display.toLocaleString()}{suffix}</>;
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const stats = useLiveStats();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('scroll', handleScroll);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        .hero-glow {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(153,69,255,0.08) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #00ff88;
          display: inline-block;
          margin-right: 6px;
          animation: pulse-live 2s ease-in-out infinite;
        }

        @keyframes pulse-live {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,255,136,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(0,255,136,0); }
        }

        .glass-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(12px);
          border-radius: 16px;
        }

        .code-block {
          background: rgba(0,0,0,0.6);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 13px;
          line-height: 1.7;
          padding: 24px;
          overflow-x: auto;
        }

        .ticker-bar {
          display: flex;
          gap: 32px;
          justify-content: center;
          align-items: center;
          font-size: 12px;
          letter-spacing: 0.05em;
          color: rgba(255,255,255,0.5);
          font-weight: 500;
        }

        .ticker-value {
          color: #00ff88;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
      `}</style>

      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#050505]/90 backdrop-blur-xl border-b border-white/5 py-3'
          : 'bg-transparent py-6'
      }`}>
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center font-bold text-sm">S</div>
            <span className="font-bold text-lg tracking-tight">SOLNET</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400 font-medium">
            <a href="#integration" className="hover:text-white transition-colors">Integration</a>
            <a href="#economics" className="hover:text-white transition-colors">Economics</a>
            <a href="https://github.com/Zach-al/solana-nervous-system" className="hover:text-white transition-colors">GitHub</a>
          </div>
          <div className="flex items-center gap-3">
            {stats && (
              <div className="hidden sm:flex items-center text-xs font-medium text-gray-500">
                <span className="live-dot" />
                <span className="ticker-value">{stats.requests_served}</span>
                <span className="ml-1">requests</span>
              </div>
            )}
            <Link
              href="/"
              className="bg-white text-black px-4 py-2 rounded-full text-sm font-semibold hover:bg-purple-500 hover:text-white transition-all duration-300"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="hero-glow" />

        {/* Globe background — hidden on mobile for battery */}
        {!isMobile && (
          <div className="absolute inset-0 z-0 opacity-40">
            <Globe />
          </div>
        )}

        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-gray-400 mb-8">
            <span className="live-dot" />
            Network Live — {stats ? <><AnimatedNumber value={stats.requests_served} /> requests served</> : 'Connecting...'}
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            Decentralized RPC<br />
            <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">for Solana.</span>
          </h1>

          <p className="text-gray-400 text-base sm:text-lg max-w-lg mx-auto mb-10 leading-relaxed font-medium">
            Replace your centralized RPC with a self-healing P2P mesh.
            One line of code. Zero downtime. Privacy by default.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://www.npmjs.com/package/solnet-sdk"
              className="bg-purple-600 hover:bg-purple-700 px-8 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-purple-600/20 text-sm"
            >
              npm install solnet-sdk
            </a>
            <a
              href="https://github.com/Zach-al/solana-nervous-system"
              className="bg-white/5 border border-white/10 px-8 py-3.5 rounded-xl font-semibold hover:bg-white/10 transition-all text-sm"
            >
              View Source
            </a>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 opacity-30 animate-bounce">
          <svg width="16" height="24" viewBox="0 0 16 24" fill="none"><path d="M8 4v12m0 0l4-4m-4 4L4 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </section>

      {/* Live Ticker Bar */}
      {stats && (
        <section className="py-4 border-y border-white/5 bg-white/[0.01]">
          <div className="ticker-bar">
            <div><span className="ticker-value"><AnimatedNumber value={stats.requests_served} /></span> Requests Served</div>
            <div className="hidden sm:block">·</div>
            <div className="hidden sm:block"><span className="ticker-value">{stats.earnings_sol.toFixed(6)}</span> SOL Earned</div>
            <div className="hidden sm:block">·</div>
            <div className="hidden sm:block"><span className="ticker-value">{Math.floor(stats.uptime_seconds / 3600)}h</span> Uptime</div>
            <div className="hidden sm:block">·</div>
            <div className="hidden sm:block"><span className="live-dot" style={{ marginRight: 4 }} /><span className="ticker-value">{stats.status.toUpperCase()}</span></div>
          </div>
        </section>
      )}

      {/* Integration — Code Snippet */}
      <section id="integration" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.3em] text-purple-500 font-semibold mb-3">Integration</p>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">One line. That&apos;s it.</h2>
          </div>

          <div className="code-block">
            <div className="text-gray-500 mb-3">{'// Replace your centralized RPC'}</div>
            <div><span className="text-purple-400">import</span> {'{'} <span className="text-green-400">SolnetConnection</span> {'}'} <span className="text-purple-400">from</span> <span className="text-amber-300">&apos;solnet-sdk&apos;</span></div>
            <br />
            <div><span className="text-purple-400">const</span> connection = <span className="text-purple-400">new</span> <span className="text-green-400">SolnetConnection</span>({'{'}</div>
            <div className="pl-4"><span className="text-blue-300">privacy</span>: <span className="text-amber-300">true</span>,</div>
            <div>{'}'})</div>
            <br />
            <div className="text-gray-500">{'// Everything else stays identical'}</div>
            <div><span className="text-purple-400">const</span> balance = <span className="text-purple-400">await</span> connection.<span className="text-blue-300">getBalance</span>(publicKey)</div>
          </div>

          <div className="mt-6 text-center">
            <a
              href="https://www.npmjs.com/package/solnet-sdk"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors font-medium"
            >
              View on npm →
            </a>
          </div>
        </div>
      </section>

      {/* Value Props — 3 cards */}
      <section className="py-24 px-6 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-8">
            <div className="text-2xl mb-4">🌐</div>
            <h3 className="text-white font-bold text-lg mb-2">Decentralized</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              No single company controls your uptime. Thousands of independent nodes serve your requests across 12 cities worldwide.
            </p>
          </div>
          <div className="glass-card p-8">
            <div className="text-2xl mb-4">⚡</div>
            <h3 className="text-white font-bold text-lg mb-2">Fast</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Geographic routing sends requests to the nearest node. Merkle proof verification on every response. Zero-trust, full speed.
            </p>
          </div>
          <div className="glass-card p-8">
            <div className="text-2xl mb-4">💰</div>
            <h3 className="text-white font-bold text-lg mb-2">Profitable</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Node operators earn SOL + $SOLNET tokens for every request routed. Stake more to earn more. Fully automated settlement.
            </p>
          </div>
        </div>
      </section>

      {/* Economics */}
      <section id="economics" className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-purple-500 font-semibold mb-3">Node Economics</p>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight mb-4">Earn while you route.</h2>
          <p className="text-gray-400 text-sm max-w-lg mx-auto mb-12">
            Every verified RPC request mints 10 $SOLNET tokens to the serving node.
            ZK-compressed batch settlement keeps costs at ~0.000005 SOL per settlement.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { val: '10', label: '$SOLNET / req', sub: 'Reward Rate' },
              { val: '0.1', label: 'SOL Minimum', sub: 'Node Stake' },
              { val: '1000×', label: 'Cost Reduction', sub: 'ZK Batching' },
              { val: '100', label: 'Starting Score', sub: 'Reputation' },
            ].map((item) => (
              <div key={item.sub} className="glass-card py-6 px-4">
                <div className="text-2xl font-bold text-white mb-1">{item.val}</div>
                <div className="text-xs text-purple-400 font-semibold mb-0.5">{item.label}</div>
                <div className="text-[10px] text-gray-600">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center font-bold text-[10px]">S</div>
            <span className="text-sm font-semibold tracking-tight">SOLNET</span>
            <span className="text-xs text-gray-600">V1.0.0</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500">
            <a href="https://github.com/Zach-al/solana-nervous-system" className="hover:text-white transition-colors">GitHub</a>
            <a href="https://www.npmjs.com/package/solnet-sdk" className="hover:text-white transition-colors">NPM</a>
            <Link href="/" className="hover:text-white transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
