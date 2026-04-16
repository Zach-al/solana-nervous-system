'use client';

import { useState, useEffect } from 'react';
import { secureFetch } from '../lib/secure-fetch';

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
        pending_receipts: 0,
        last_settled_lamports: 0,
        last_settled_receipts: 0,
        last_settled_at: 'NEVER',
        total_earned_sol: 0,
        next_settlement_seconds: 3600,
        merkle_root: 'IDENTITY_INITIALIZING'
    });

    useEffect(() => {
        const fetchEarnings = async () => {
            try {
                const res = await secureFetch('/api/daemon/wallet');
                if (res.ok) {
                    const status = await res.json();
                    setData(prev => ({
                        ...prev,
                        pending_receipts: status.session_requests,
                        total_earned_sol: status.lifetime_earned_sol,
                        next_settlement_seconds: status.next_settlement_in_secs,
                        merkle_root: status.wallet_address.slice(0, 16) + '...'
                    }));
                }
            } catch (err) {
                console.error("Failed to fetch earnings", err);
            }
        };

        fetchEarnings();
        const interval = setInterval(fetchEarnings, 5000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="panel-header" style={{ borderBottom: 'none', padding: '0 0 8px 0' }}>
                SETTLEMENT_CORE <span>[ZK_V0.3]</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-main)', border: '1px solid var(--border-main)' }}>
                <div className="metric-block" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
                    <div className="metric-label">PENDING_BATCH</div>
                    <div className="metric-value">{data.pending_receipts}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>RECEIPTS_READY</div>
                </div>
                <div className="metric-block" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
                    <div className="metric-label">NEXT_FLUSH</div>
                    <div className="metric-value" style={{ color: 'var(--amber)' }}>{formatTime(data.next_settlement_seconds)}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>AUTO_SETTLE_CLK</div>
                </div>
            </div>

            <div className="metric-block">
                <div className="metric-label">SETTLEMENT_INTEGRITY</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px', fontFamily: 'var(--font-technical)' }}>
                    <span style={{ color: 'var(--text-dim)' }}>TOTAL_ACCUMULATED:</span>
                    <span style={{ fontWeight: 700 }}>{data.total_earned_sol.toFixed(4)} SOL</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px', fontFamily: 'var(--font-technical)' }}>
                    <span style={{ color: 'var(--text-dim)' }}>LAST_EPOCH_SIZE:</span>
                    <span>{data.last_settled_lamports.toLocaleString()} L</span>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', borderLeft: '2px solid var(--electric-purple)', marginTop: '8px' }}>
                    <div className="metric-label" style={{ marginBottom: '4px', fontSize: '9px' }}>ACTIVE_MERKLE_ROOT</div>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-technical)', wordBreak: 'break-all', color: 'var(--text-dim)' }}>
                        {data.merkle_root}
                    </div>
                </div>
            </div>
        </div>
    );
}
