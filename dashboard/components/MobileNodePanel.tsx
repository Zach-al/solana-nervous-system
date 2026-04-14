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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMobileNodes = async () => {
      try {
        const res = await fetch(`${API_BASE}/mobile/peers`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        
        // Transform peer registry data into mobile node info
        const peers = data.peers || []
        const nodes: MobileNodeInfo[] = peers
          .filter((p: any) => typeof p.endpoint === 'string' && p.endpoint.startsWith('mobile:'))
          .map((p: any) => ({
            platform: p.endpoint.replace('mobile:', ''),
            nodeId: p.peer_id,
            assignedPeer: data.bootstrap || API_BASE,
            batteryLevel: 100,
            charging: true,
            throttled: false,
            requestsForwarded: 0,
          }))
        
        setMobileNodes(nodes)
        setError(null)
      } catch {
        setError('Unable to reach bootstrap node')
      } finally {
        setLoading(false)
      }
    }

    fetchMobileNodes()
    const interval = setInterval(fetchMobileNodes, 10000) // Poll every 10s
    return () => clearInterval(interval)
  }, [])

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'ios': return '🍎'
      case 'android': return '🤖'
      case 'raspberry pi': return '🍓'
      default: return '📱'
    }
  }

  return (
    <div style={{
      background: 'rgba(16, 16, 32, 0.85)',
      borderRadius: '16px',
      border: '1px solid rgba(153, 69, 255, 0.2)',
      padding: '20px',
      backdropFilter: 'blur(12px)',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
      }}>
        <span style={{ fontSize: '20px' }}>📱</span>
        <h3 style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: 600,
          color: '#9945ff',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
        }}>
          Mobile Nodes
        </h3>
        <span style={{
          marginLeft: 'auto',
          fontSize: '11px',
          color: mobileNodes.length > 0 ? '#00ff88' : '#666',
          background: mobileNodes.length > 0 ? 'rgba(0, 255, 136, 0.1)' : 'rgba(100, 100, 100, 0.1)',
          padding: '2px 8px',
          borderRadius: '10px',
          border: `1px solid ${mobileNodes.length > 0 ? 'rgba(0, 255, 136, 0.3)' : 'rgba(100, 100, 100, 0.3)'}`,
        }}>
          {mobileNodes.length} connected
        </span>
      </div>

      {loading && (
        <div style={{ color: '#666', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
          Scanning mesh for mobile nodes...
        </div>
      )}

      {error && (
        <div style={{ color: '#ff6b6b', fontSize: '11px', textAlign: 'center', padding: '10px 0' }}>
          {error}
        </div>
      )}

      {!loading && mobileNodes.length === 0 && !error && (
        <div style={{
          textAlign: 'center',
          padding: '24px 12px',
          color: '#555',
          fontSize: '12px',
          lineHeight: '1.8',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.3 }}>📱</div>
          <div style={{ color: '#888' }}>No mobile nodes yet</div>
          <div style={{ color: '#555', fontSize: '11px', marginTop: '4px' }}>
            Run SOLNET on your phone to see it here
          </div>
        </div>
      )}

      {mobileNodes.map((node, i) => (
        <div key={node.nodeId} style={{
          background: 'rgba(153, 69, 255, 0.05)',
          border: '1px solid rgba(153, 69, 255, 0.15)',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: i < mobileNodes.length - 1 ? '8px' : 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '14px' }}>
              {getPlatformIcon(node.platform)} {node.platform}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              color: node.throttled ? '#ffaa00' : '#00ff88',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: node.throttled ? '#ffaa00' : '#00ff88',
                boxShadow: `0 0 6px ${node.throttled ? '#ffaa00' : '#00ff88'}`,
              }} />
              {node.throttled ? 'THROTTLED' : 'ONLINE'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '10px', color: '#888' }}>
            <div>
              BATTERY: <span style={{ color: node.batteryLevel > 20 ? '#00ff88' : '#ff6b6b' }}>
                {node.batteryLevel}%
              </span>
              {node.charging && ' ⚡'}
            </div>
            <div>
              PEER: <span style={{ color: '#9945ff' }}>
                {node.assignedPeer.slice(0, 20)}...
              </span>
            </div>
            <div>
              ID: <span style={{ color: '#aaa' }}>
                {node.nodeId.slice(0, 8)}...
              </span>
            </div>
            <div>
              FWD: <span style={{ color: '#14f195' }}>
                {node.requestsForwarded}
              </span> requests
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
