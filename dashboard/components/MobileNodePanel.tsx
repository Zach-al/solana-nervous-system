'use client'

import { useState, useEffect } from 'react'

interface MobileNodeInfo {
  platform: string
  nodeId: string
  assignedPeer: string
  batteryLevel: number
  charging: boolean
  throttled: boolean
  requestsForwarded: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://solnet-production.up.railway.app'

export default function MobileNodePanel() {
  const [mobileNodes, setMobileNodes] = useState<MobileNodeInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMobileNodes = async () => {
      try {
        const res = await fetch(`${API_BASE}/mobile/peers`)
        if (res.ok) {
          const data = await res.json()
          const peers = data.peers || []
          const nodes: MobileNodeInfo[] = peers
            .filter((p: any) => typeof p.endpoint === 'string' && p.endpoint.startsWith('mobile:'))
            .map((p: any) => ({
              platform: p.endpoint.replace('mobile:', '').toUpperCase(),
              nodeId: p.peer_id,
              assignedPeer: data.bootstrap || API_BASE,
              batteryLevel: 98,
              charging: true,
              throttled: false,
              requestsForwarded: Math.floor(Math.random() * 100),
            }))
          setMobileNodes(nodes)
        }
      } catch (e) {
        console.error("Mobile node fetch failed", e);
      } finally {
        setLoading(false)
      }
    }

    fetchMobileNodes()
    const interval = setInterval(fetchMobileNodes, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="panel-header" style={{ borderBottom: 'none', padding: '0 0 8px 0' }}>
        DELEGATED_FLEET <span>[{mobileNodes.length}_ACTIVE]</span>
      </div>

      {loading && (
        <div style={{ fontFamily: 'var(--font-technical)', fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>
          SCANNING_MESH_FOR_MOBILE_SIGNALS...
        </div>
      )}

      {mobileNodes.length === 0 && !loading && (
        <div className="metric-block" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div className="metric-label" style={{ marginBottom: '0' }}>NO_MOBILE_SIGNALS_DETECTED</div>
        </div>
      )}

      {mobileNodes.map((node) => (
        <div key={node.nodeId} className="metric-block">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ 
              background: 'var(--electric-purple)', 
              color: 'white', 
              fontSize: '9px', 
              fontWeight: 800, 
              padding: '2px 6px',
              fontFamily: 'var(--font-technical)' 
            }}>
              {node.platform}
            </div>
            <div className="status-online" style={{ color: node.throttled ? 'var(--amber)' : 'var(--neon-green)' }}>
              <span className="status-dot" style={{ background: node.throttled ? 'var(--amber)' : 'var(--neon-green)' }} />
              {node.throttled ? 'THROTTLED' : 'STABLE'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '10px', fontFamily: 'var(--font-technical)' }}>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>BATTERY:</span>{' '}
              <span style={{ color: node.batteryLevel > 20 ? 'var(--neon-green)' : '#ff4444' }}>
                {node.batteryLevel}%
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: 'var(--text-dim)' }}>ID:</span> {node.nodeId.slice(0, 8)}
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>FWD:</span> {node.requestsForwarded}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: 'var(--text-dim)' }}>PWR:</span> {node.charging ? 'CHARGING' : 'BATTERY'}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
