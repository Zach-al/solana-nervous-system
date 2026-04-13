'use client';

import React, { useEffect, useState } from 'react';
import Globe from '../../components/Globe';
import Link from 'next/link';

const Counter = ({ value, label, sub }: { value: string, label: string, sub: string }) => (
  <div className="flex flex-col items-center">
    <div className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500 mb-2">
      {value}
    </div>
    <div className="text-xs uppercase tracking-widest text-purple-400 font-semibold mb-1">{label}</div>
    <div className="text-[10px] text-gray-500 uppercase tracking-tighter">{sub}</div>
  </div>
);

const FeatureCard = ({ icon, title, desc }: { icon: string, title: string, desc: string }) => (
  <div className="bg-white/[0.03] border border-white/[0.05] p-8 rounded-2xl hover:bg-white/[0.05] transition-all duration-300">
    <div className="text-3xl mb-4">{icon}</div>
    <div className="text-white font-bold mb-2">{title}</div>
    <div className="text-gray-400 text-sm leading-relaxed">{desc}</div>
  </div>
);

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-500/30">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 py-4' : 'bg-transparent py-8'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center font-bold">S</div>
            <span className="font-bold tracking-tighter text-xl">SOLNET</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#tech" className="hover:text-white transition-colors">Infrastructure</a>
            <a href="https://github.com/Zach-al/solana-nervous-system" className="hover:text-white transition-colors">Docs</a>
          </div>
          <Link 
            href="/"
            className="bg-white text-black px-5 py-2 rounded-full text-sm font-bold hover:bg-purple-600 hover:text-white transition-all duration-300"
          >
            Enter Dashboard
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Globe />
        </div>
        
        <div className="relative z-10 text-center px-6">
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-none mb-6">
            Solana is decentralized.<br />
            <span className="text-[#9945FF]">Its infrastructure should be too.</span>
          </h1>
          <p className="max-w-xl mx-auto text-gray-400 md:text-xl font-medium mb-12 leading-relaxed">
            The world's first decentralized RPC mesh network for Solana. 
            Privacy-first, hyper-scaled, and node-incentivized.
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <Link href="/" className="bg-purple-600 px-8 py-4 rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20">
              Run a Node
            </Link>
            <a href="https://github.com/Zach-al/solana-nervous-system" className="bg-white/5 border border-white/10 backdrop-blur-md px-8 py-4 rounded-xl font-bold hover:bg-white/10 transition-all">
              Read the Docs
            </a>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-12 animate-bounce opacity-40">
          <div className="w-[1px] h-12 bg-gradient-to-b from-transparent to-white" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
          <Counter value="2,341" label="Active Nodes" sub="Globally Distributed" />
          <Counter value="1.2M+" label="Requests Served" sub="Verified via Merkle" />
          <Counter value="4.2k" label="SOL Earned" sub="Incentivized RPC" />
          <Counter value="99.97%" label="Uptime" sub="Zero Single Point Failure" />
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-xs uppercase tracking-[0.4em] text-purple-500 font-bold mb-4">// THE ECOSYSTEM</h2>
            <h3 className="text-3xl md:text-5xl font-bold tracking-tight">Deploy in seconds. Scale forever.</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon="⚡" 
              title="1. Install" 
              desc="Deploy the SOLNET daemon to any server in one command. Compatible with all Solana RPC nodes."
            />
            <FeatureCard 
              icon="🌐" 
              title="2. Join" 
              desc="Connect to the global P2P mesh and start processing requests. Cryptographic proofs ensure honesty."
            />
            <FeatureCard 
              icon="💎" 
              title="3. Earn" 
              desc="Earn SOL and $SOLNET tokens for every verified request you serve. Real-time settlement on devnet."
            />
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section id="tech" className="py-32 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-16 tracking-tight">Built with industrial-grade tech</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8 opacity-50 hover:opacity-100 transition-opacity duration-500">
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold">RUST</div>
              <div className="text-[10px] text-gray-500">CORE DAEMON</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold">SOLANA</div>
              <div className="text-[10px] text-gray-500">SETTLEMENT</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold">LIBP2P</div>
              <div className="text-[10px] text-gray-500">NETWORKING</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold">NEXT.JS</div>
              <div className="text-[10px] text-gray-500">DASHBOARD</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold">THREE.JS</div>
              <div className="text-[10px] text-gray-500">VISUALS</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl font-bold">ANCHOR</div>
              <div className="text-[10px] text-gray-500">SMART CONTRACT</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-white/5 text-center">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center gap-8 mb-8">
            <a href="https://github.com/Zach-al/solana-nervous-system" className="text-gray-500 hover:text-white transition-colors">GitHub</a>
            <Link href="/" className="text-gray-500 hover:text-white transition-colors">Dashboard</Link>
          </div>
          <div className="text-sm text-gray-600 mb-2">Built at Solana Hackathon 2026</div>
          <div className="text-[10px] text-gray-700 uppercase tracking-widest font-black">SOLNET V1.0.0 MAINNET-READY</div>
        </div>
      </footer>
    </div>
  );
}
