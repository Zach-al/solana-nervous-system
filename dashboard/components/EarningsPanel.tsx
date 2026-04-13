'use client';

import { useState, useEffect } from 'react';

interface EarningsData {
    pending_receipts: number;
    last_settled_lamports: number;
    last_settled_receipts: number;
    last_settled_at: string;
    total_earned_sol: number;
    next_settlement_seconds: number;
    merkle_root: string;
}

export default function EarningsPanel() {
    const [data, setData] = useState<EarningsData>({
        pending_receipts: 42,
        last_settled_lamports: 150000,
        last_settled_receipts: 150,
        last_settled_at: '22 mins ago',
        total_earned_sol: 0.0452,
        next_settlement_seconds: 2280,
        merkle_root: '7f8e9a...b2c3d4'
    });

    // Countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            setData(prev => ({
                ...prev,
                next_settlement_seconds: Math.max(0, prev.next_settlement_seconds - 1)
            }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    return (
        <div className="earnings-panel" style={{ 
            background: 'rgba(0, 0, 0, 0.4)', 
            border: '1px solid var(--green-dim)', 
            padding: '20px', 
            borderRadius: '8px',
            fontFamily: 'monospace',
            color: 'var(--green-primary)'
        }}>
            <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '15px', letterSpacing: '0.1em' }}>
                // EARNINGS & SETTLEMENT [V0.3]
            </div>

            <div className="earnings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="earnings-section">
                    <div style={{ fontSize: '10px', color: 'var(--green-dim)' }}>CURRENT BATCH</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{data.pending_receipts}</div>
                    <div style={{ fontSize: '10px', opacity: 0.8 }}>RECEIPTS PENDING</div>
                </div>

                <div className="earnings-section">
                    <div style={{ fontSize: '10px', color: 'var(--green-dim)' }}>NEXT SETTLEMENT</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--amber)' }}>{formatTime(data.next_settlement_seconds)}</div>
                    <div style={{ fontSize: '10px', opacity: 0.8 }}>AUTO-FLUSH</div>
                </div>
            </div>

            <div style={{ margin: '20px 0', padding: '15px 0', borderTop: '1px solid rgba(0, 255, 136, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--green-dim)' }}>TOTAL EARNED:</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{data.total_earned_sol.toFixed(4)} SOL</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--green-dim)' }}>LAST SETTLED:</span>
                    <span style={{ fontSize: '11px' }}>{data.last_settled_lamports.toLocaleString()} lamports</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'var(--green-dim)' }}>BATCH EFFICIENCY:</span>
                    <span style={{ fontSize: '11px', color: 'var(--green-primary)' }}>1,000x cost floor</span>
                </div>
            </div>

            <div style={{ fontSize: '10px', background: 'rgba(0,0,0,0.3)', padding: '10px', borderLeft: '2px solid var(--green-primary)' }}>
                <div style={{ color: 'var(--green-dim)', marginBottom: '4px' }}>CURRENT MERKLE ROOT:</div>
                <div style={{ wordBreak: 'break-all', opacity: 0.7 }}>{data.merkle_root}</div>
                <div style={{ marginTop: '8px', color: 'var(--green-dim)' }}>SETTLEMENT COST: <span style={{ color: 'var(--green-primary)' }}>~0.000005 SOL</span></div>
            </div>
        </div>
    );
}
