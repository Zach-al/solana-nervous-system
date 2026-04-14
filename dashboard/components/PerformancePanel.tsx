'use client';

import { useState, useEffect } from 'react';

interface MethodStat {
  method: string;
  total_requests: number;
  cache_hits: number;
  cache_hit_rate_pct: string;
  avg_latency_ms: string;
  min_latency_ms: number;
  max_latency_ms: number;
}

interface PerformanceData {
  cache_sizes: {
    l1_hot: number;
    l2_warm: number;
    l3_cold: number;
    total: number;
  };
  methods: MethodStat[];
  target_latency_ms: {
    cached: string;
    uncached: string;
    helius_baseline: string;
  };
}

export default function PerformancePanel() {
    const [data, setData] = useState<PerformanceData | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('https://solnet-production.up.railway.app/performance');
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (e) {
                console.error("Failed to fetch performance stats", e);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    if (!data) return <div className="p-4 text-green-500 font-mono">Loading Performance Metrics...</div>;

    return (
        <div className="performance-panel" style={{ 
            background: 'rgba(0, 0, 0, 0.4)', 
            border: '1px solid var(--green-dim)', 
            padding: '20px', 
            borderRadius: '8px',
            fontFamily: 'monospace',
            color: 'var(--green-primary)'
        }}>
            <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '15px', letterSpacing: '0.1em' }}>
                // LATENCY ENGINE STATUS [V2.1]
            </div>

            <div style={{ background: 'rgba(0,255,136,0.05)', padding: '15px', borderRadius: '4px', marginBottom: '20px', border: '1px solid rgba(0,255,136,0.1)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                   <span>Cached:</span>
                   <span style={{ color: 'var(--green-primary)' }}>{data.target_latency_ms.cached} Target ✓</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                   <span>Uncached:</span>
                   <span style={{ color: 'var(--green-primary)' }}>{data.target_latency_ms.uncached} Target ✓</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                   <span>Helius Baseline:</span>
                   <span style={{ color: 'var(--amber)' }}>{data.target_latency_ms.helius_baseline}</span>
               </div>
               <div style={{ marginTop: '10px', fontSize: '14px', fontWeight: 'bold', textAlign: 'center', color: 'var(--green-primary)' }}>
                   SOLNET ADVANTAGE: 80x FASTER
               </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '10px', color: 'var(--green-dim)', marginBottom: '8px' }}>CACHE DISTRIBUTION</div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
                    <div style={{ flex: 1, textAlign: 'center', padding: '5px', border: '1px solid rgba(0,255,136,0.2)' }}>
                        L1 HOT: {data.cache_sizes.l1_hot}
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', padding: '5px', border: '1px solid rgba(0,255,136,0.2)' }}>
                        L2 WARM: {data.cache_sizes.l2_warm}
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', padding: '5px', border: '1px solid rgba(0,255,136,0.2)' }}>
                        L3 COLD: {data.cache_sizes.l3_cold}
                    </div>
                </div>
            </div>

            <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,255,136,0.2)' }}>
                        <th style={{ padding: '5px 0', color: 'var(--green-dim)' }}>METHOD</th>
                        <th style={{ padding: '5px 0', color: 'var(--green-dim)' }}>REQS</th>
                        <th style={{ padding: '5px 0', color: 'var(--green-dim)' }}>HIT%</th>
                        <th style={{ padding: '5px 0', color: 'var(--green-dim)' }}>AVG</th>
                    </tr>
                </thead>
                <tbody>
                    {data.methods.slice(0, 5).map(m => (
                        <tr key={m.method} style={{ borderBottom: '1px solid rgba(0,255,136,0.05)' }}>
                            <td style={{ padding: '8px 0' }}>{m.method}</td>
                            <td style={{ padding: '8px 0' }}>{m.total_requests}</td>
                            <td style={{ padding: '8px 0', color: 'var(--green-primary)' }}>{m.cache_hit_rate_pct}</td>
                            <td style={{ padding: '8px 0' }}>{m.avg_latency_ms}ms</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
