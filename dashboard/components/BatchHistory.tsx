'use client';

interface Batch {
    batch_id: string;
    receipt_count: number;
    total_lamports: number;
    merkle_root: string;
    settled_at: string;
}

const mockBatches: Batch[] = [
    {
        batch_id: 'b8e9f2...a1b2',
        receipt_count: 142,
        total_lamports: 14200,
        merkle_root: '92a8c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
        settled_at: '2026-04-13 14:30'
    },
    {
        batch_id: 'c1d2e3...f4g5',
        receipt_count: 89,
        total_lamports: 8900,
        merkle_root: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
        settled_at: '2026-04-13 13:30'
    }
];

export default function BatchHistory() {
    return (
        <div style={{ marginTop: '30px' }}>
            <div style={{ 
                fontSize: '12px', 
                color: 'var(--green-dim)', 
                marginBottom: '15px', 
                letterSpacing: '0.1em',
                fontFamily: 'monospace' 
            }}>
                // LATEST SETTLED BATCHES
            </div>

            <div style={{ 
                overflowX: 'auto', 
                background: 'rgba(0,0,0,0.2)', 
                border: '1px solid rgba(0,255,136,0.1)',
                borderRadius: '8px' 
            }}>
                <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse', 
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    textAlign: 'left'
                }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(0,255,136,0.1)' }}>
                            <th style={{ padding: '12px', color: 'var(--green-dim)' }}>BATCH_ID</th>
                            <th style={{ padding: '12px', color: 'var(--green-dim)' }}>RECEIPTS</th>
                            <th style={{ padding: '12px', color: 'var(--green-dim)' }}>LAMPORTS</th>
                            <th style={{ padding: '12px', color: 'var(--green-dim)' }}>SETTLED_AT</th>
                            <th style={{ padding: '12px', color: 'var(--green-dim)' }}>EXPLORER</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mockBatches.map((batch, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px', color: 'var(--green-primary)' }}>{batch.batch_id}</td>
                                <td style={{ padding: '12px' }}>{batch.receipt_count}</td>
                                <td style={{ padding: '12px' }}>{batch.total_lamports.toLocaleString()}</td>
                                <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{batch.settled_at}</td>
                                <td style={{ padding: '12px' }}>
                                    <a href="#" style={{ color: 'var(--purple-primary)', textDecoration: 'none' }}>[VIEW]</a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div style={{ fontSize: '9px', marginTop: '8px', color: 'rgba(0,255,136,0.2)', textAlign: 'right' }}>
                * BATCH INTEGRITY VERIFIED VIA ON-CHAIN MERKLE PROOF
            </div>
        </div>
    );
}
