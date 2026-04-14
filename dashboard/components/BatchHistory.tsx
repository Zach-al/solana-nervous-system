'use client';

import { useState } from 'react';

interface Batch {
    batch_id: string;
    receipt_count: number;
    total_lamports: number;
    merkle_root: string;
    settled_at: string;
    status: 'SETTLED' | 'VERIFIED' | 'PENDING';
}

const mockBatches: Batch[] = [
    {
        batch_id: 'SN-B8E9F2-A1B2',
        receipt_count: 142,
        total_lamports: 14200,
        merkle_root: '92a8c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
        settled_at: '2026-04-14 14:30',
        status: 'VERIFIED'
    },
    {
        batch_id: 'SN-C1D2E3-F4G5',
        receipt_count: 89,
        total_lamports: 8900,
        merkle_root: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
        settled_at: '2026-04-14 13:30',
        status: 'SETTLED'
    }
];

export default function BatchHistory() {
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

    return (
        <div className="metric-block" style={{ padding: 0 }}>
            <div className="panel-header" style={{ borderBottom: 'none' }}>
                SETTLEMENT_HISTORY <span>[MERKLE_PROOFS]</span>
            </div>
            
            <table className="data-table">
                <thead>
                    <tr>
                        <th>BATCH_SEQ</th>
                        <th>COUNT</th>
                        <th>VOLUME (L)</th>
                        <th>TIMESTAMP</th>
                        <th style={{ textAlign: 'right' }}>ACTION</th>
                    </tr>
                </thead>
                <tbody>
                    {mockBatches.map((batch, index) => (
                        <tr key={index}>
                            <td style={{ color: 'var(--electric-purple)', fontWeight: 700 }}>{batch.batch_id}</td>
                            <td>{batch.receipt_count}</td>
                            <td>{batch.total_lamports.toLocaleString()}</td>
                            <td style={{ color: 'var(--text-dim)', fontSize: '10px' }}>{batch.settled_at}</td>
                            <td style={{ textAlign: 'right' }}>
                                <button 
                                    className="btn-technical"
                                    onClick={() => setSelectedBatch(batch)}
                                >
                                    [VIEW_SPECS]
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Technical Detail Overlay (Modal) */}
            {selectedBatch && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '600px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-main)',
                        position: 'relative'
                    }}>
                        <div className="panel-header">
                            BATCH_INTERNAL_SPECIFICATION: {selectedBatch.batch_id}
                            <button 
                                onClick={() => setSelectedBatch(null)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '16px' }}
                            >
                                [X]
                            </button>
                        </div>
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="metric-block" style={{ border: 'none', padding: 0 }}>
                                <div className="metric-label">MERKLE_ROOT_IDENTITY</div>
                                <div style={{ 
                                    fontFamily: 'var(--font-technical)', 
                                    fontSize: '11px', 
                                    color: 'var(--electric-purple)', 
                                    wordBreak: 'break-all',
                                    background: 'rgba(255,255,255,0.02)',
                                    padding: '12px',
                                    border: '1px solid var(--border-main)'
                                }}>
                                    {selectedBatch.merkle_root}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-main)' }}>
                                <div style={{ background: 'var(--bg-secondary)', padding: '16px' }}>
                                    <div className="metric-label">SETTLEMENT_STATUS</div>
                                    <div style={{ color: 'var(--neon-green)', fontFamily: 'var(--font-technical)', fontSize: '14px', fontWeight: 700 }}>
                                        {selectedBatch.status}
                                    </div>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', padding: '16px' }}>
                                    <div className="metric-label">NETWORK_CONFIRMATIONS</div>
                                    <div style={{ fontFamily: 'var(--font-technical)', fontSize: '14px', fontWeight: 700 }}>
                                        MAX_FINALITY
                                    </div>
                                </div>
                            </div>

                            <div style={{ fontSize: '10px', color: 'var(--text-dim)', lineHeight: '1.6', fontFamily: 'var(--font-technical)' }}>
                                // THIS BATCH HAS BEEN IMMUTABLY COMMITTED TO THE SOLANA LEDGER.<br/>
                                // PROOF_VERIFICATION: SUCCESSFUL<br/>
                                // INTEGRITY_CHECK: PASSED
                            </div>

                            <button 
                                className="btn-technical" 
                                style={{ width: '100%', padding: '12px' }}
                                onClick={() => setSelectedBatch(null)}
                            >
                                [CLOSE_SPECIFICATION]
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
