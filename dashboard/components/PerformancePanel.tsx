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
  };
}

export default function PerformancePanel() {
    const [data, setData] = useState<PerformanceData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/daemon/performance');
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                    setError(null);
                } else {
                    setError(`HTTP_${res.status}`);
                }
            } catch (e) {
                setError('OFFLINE');
                console.error("Failed to fetch performance stats", e);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    if (error) return (
        <div className="metric-block" style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div className="metric-label" style={{ color: '#ef4444' }}>[METRICS_OFFLINE]</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>UPSTREAM_FAILURE: {error}</div>
        </div>
    );

    if (!data) return (
        <div className="metric-block" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="metric-label" style={{ color: 'var(--electric-purple)' }}>[LOAD_SEQUENCER_ACTIVE]</div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-main)', border: '1px solid var(--border-main)' }}>
                <div className="metric-block" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
                    <div className="metric-label">CACHED_RESPONSE</div>
                    <div className="metric-value" style={{ color: 'var(--neon-green)' }}>{data.target_latency_ms.cached}ms</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>LATENCY_OPTIMIZED</div>
                </div>
                <div className="metric-block" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
                    <div className="metric-label">UNCACHED_RESPONSE</div>
                    <div className="metric-value">{data.target_latency_ms.uncached}ms</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>VALIDATED_DIRECT</div>
                </div>
            </div>

            <div className="metric-block">
                <div className="metric-label">CACHE_DISTRIBUTION_FLEET</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>L1_HOT</div>
                        <div style={{ fontFamily: 'var(--font-technical)', fontSize: '16px', fontWeight: 700 }}>{data.cache_sizes.l1_hot}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>L2_WARM</div>
                        <div style={{ fontFamily: 'var(--font-technical)', fontSize: '16px', fontWeight: 700 }}>{data.cache_sizes.l2_warm}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>L3_COLD</div>
                        <div style={{ fontFamily: 'var(--font-technical)', fontSize: '16px', fontWeight: 700 }}>{data.cache_sizes.l3_cold}</div>
                    </div>
                </div>
            </div>

            <div className="metric-block" style={{ padding: '0' }}>
                <div className="panel-header" style={{ borderBottom: 'none' }}>METHOD_LATENCY_SPECTRUM</div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>INTERFACE</th>
                            <th>VOLUME</th>
                            <th>EFFICIENCY</th>
                            <th>AVG_RES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.methods.slice(0, 6).map(m => (
                            <tr key={m.method}>
                                <td>{m.method}</td>
                                <td>{m.total_requests}</td>
                                <td style={{ color: 'var(--neon-green)' }}>{m.cache_hit_rate_pct}</td>
                                <td style={{ color: 'var(--electric-purple)' }}>{m.avg_latency_ms}ms</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
