'use client';

import React, { useEffect, useState } from 'react';

interface MeshStatus {
  peer_id: string;
  multiaddrs: string[];
  nat_status: string;
  is_relay: boolean;
  relay_reservations: number;
  connected_peers: number;
  bootstrap_peers: string[];
  dcutr_enabled: boolean;
  transport: string;
  hole_punching_attempts: number;
  hole_punching_successes: number;
  mesh_version: string;
}

export default function MeshPanel() {
  const [status, setStatus] = useState<MeshStatus | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/proxy?path=/mesh/status');
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (err) {
        console.error('Failed to fetch mesh status', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const getNatColor = (nat: string) => {
    switch (nat) {
      case 'PublicAddress': return 'var(--text-bright)'; // Greenish/bright in Stitch
      case 'Private': return '#f59e0b'; // Amber
      case 'Symmetric': return '#ef4444'; // Red
      default: return 'var(--text-dim)'; // Gray
    }
  };

  const getNatLabel = (nat: string) => {
    if (nat === 'PublicAddress') return 'PublicAddress ✓';
    if (nat === 'Unknown') return 'Unknown (detecting...)';
    return nat;
  };

  if (!status) {
    return (
      <div className="stats-panel" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-dim)' }}>INITIALIZING MESH PROTOCOLS...</p>
      </div>
    );
  }

  const shortPeerId = status.peer_id.length > 15 
    ? `${status.peer_id.slice(0, 7)}...${status.peer_id.slice(-4)}`
    : status.peer_id;

  return (
    <div className="stats-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="panel-title">P2P MESH STATUS</h2>
        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>[LIBP2P_V0.53]</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '12px', fontSize: '12px', fontFamily: 'var(--font-technical)' }}>
        <div style={{ color: 'var(--text-dim)' }}>PEER ID</div>
        <div style={{ color: 'var(--text-main)', textAlign: 'right' }}>{shortPeerId}</div>

        <div style={{ color: 'var(--text-dim)' }}>NAT STATUS</div>
        <div style={{ color: getNatColor(status.nat_status), textAlign: 'right' }}>{getNatLabel(status.nat_status)}</div>

        <div style={{ color: 'var(--text-dim)' }}>TRANSPORT</div>
        <div style={{ color: 'var(--text-main)', textAlign: 'right' }}>{status.transport}</div>

        <div style={{ color: 'var(--text-dim)' }}>PEERS</div>
        <div style={{ color: 'var(--text-main)', textAlign: 'right' }}>{status.connected_peers} connected</div>

        <div style={{ color: 'var(--text-dim)' }}>DCUTR</div>
        <div style={{ color: status.dcutr_enabled ? 'var(--text-bright)' : 'var(--text-dim)', textAlign: 'right' }}>
          {status.dcutr_enabled ? 'ENABLED' : 'DISABLED'}
        </div>

        <div style={{ color: 'var(--text-dim)' }}>RELAY MODE</div>
        <div style={{ color: status.is_relay ? 'var(--accent-primary)' : 'var(--text-dim)', textAlign: 'right' }}>
          {status.is_relay ? `YES (${status.relay_reservations} res)` : 'NO'}
        </div>

        <div style={{ color: 'var(--text-dim)' }}>HOLE PUNCH</div>
        <div style={{ color: 'var(--text-main)', textAlign: 'right' }}>
          {status.hole_punching_attempts} attempts / <span style={{ color: 'var(--text-bright)' }}>{status.hole_punching_successes} success</span>
        </div>
      </div>

      <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
        <button 
          onClick={() => setExpanded(!expanded)}
          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '10px', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-technical)' }}
        >
          {expanded ? '▼ HIDE MULTIADDRS' : '▶ VIEW MULTIADDRS'}
        </button>
        
        {expanded && (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {status.multiaddrs.map((addr, idx) => (
              <div key={idx} style={{ fontSize: '9px', color: 'var(--text-dim)', wordBreak: 'break-all', fontFamily: 'var(--font-technical)', background: 'rgba(255,255,255,0.02)', padding: '4px' }}>
                {addr}
              </div>
            ))}
            {status.multiaddrs.length === 0 && (
              <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>No bound addresses</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
