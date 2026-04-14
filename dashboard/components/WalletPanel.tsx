'use client';

import { useState, useEffect } from 'react';

interface WalletData {
  wallet_address: string;
  pending_lamports: number;
  pending_sol: number;
  confirmed_wallet_balance_lamports: number;
  confirmed_wallet_balance_sol: number;
  lifetime_earned_lamports: number;
  lifetime_earned_sol: number;
  session_requests: number;
  lamports_per_request: number;
  next_settlement_in_secs: number;
}

export default function WalletPanel() {
    const [data, setData] = useState<WalletData | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('https://solnet-production.up.railway.app/wallet');
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (e) {
                console.error("Failed to fetch wallet stats", e);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    if (!data) return <div className="p-4 text-green-500 font-mono">Loading Neural Rewards...</div>;

    return (
        <div className="wallet-panel" style={{ 
            background: 'rgba(0, 0, 0, 0.4)', 
            border: '1px solid var(--green-dim)', 
            padding: '20px', 
            borderRadius: '8px',
            fontFamily: 'monospace',
            color: 'var(--green-primary)'
        }}>
            <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '15px', letterSpacing: '0.1em' }}>
                // ENTERPRISE WALLET & REWARDS [V2.1]
            </div>

            <div style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '10px', color: 'var(--green-dim)' }}>ON-CHAIN ADDRESS</div>
                <div style={{ wordBreak: 'break-all', fontSize: '12px', color: 'var(--amber)' }}>{data.wallet_address}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                    <div style={{ fontSize: '10px', color: 'var(--green-dim)' }}>CONFIRMED BALANCE</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{data.confirmed_wallet_balance_sol.toFixed(4)} SOL</div>
                </div>
                <div>
                    <div style={{ fontSize: '10px', color: 'var(--green-dim)' }}>PENDING REWARDS</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--green-primary)' }}>(+) {data.pending_sol.toFixed(6)} SOL</div>
                </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(0,255,136,0.1)', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}>
                    <span style={{ color: 'var(--green-dim)' }}>LIFETIME EARNINGS:</span>
                    <span>{data.lifetime_earned_sol.toFixed(4)} SOL</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}>
                    <span style={{ color: 'var(--green-dim)' }}>SESSION REQUESTS:</span>
                    <span>{data.session_requests} REQS</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--green-dim)' }}>NEXT SETTLEMENT:</span>
                    <span style={{ color: 'var(--amber)' }}>{formatTime(data.next_settlement_in_secs)}</span>
                </div>
            </div>

            <div style={{ marginTop: '20px', fontSize: '9px', textAlign: 'center', opacity: 0.5 }}>
                SECURED BY ZK-RECEIPTS PORTAL
            </div>
        </div>
    );
}
