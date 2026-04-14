'use client';

export default function PrivacyPanel() {
  return (
    <div className="metric-block" style={{ border: '1px solid var(--border-stitch)' }}>
      <div className="metric-label">PRIVACY_SHIELD_PROTO</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontFamily: 'var(--font-technical)', fontSize: '12px', fontWeight: 700 }}>ONION_ROUTING</div>
        <div className="status-online">
          <span className="status-dot" />
          ACTIVE
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '10px', fontFamily: 'var(--font-technical)' }}>
          <div style={{ color: 'var(--text-dim)' }}>ENCRYPTION:</div>
          <div style={{ textAlign: 'right' }}>AES-256-GCM</div>
          <div style={{ color: 'var(--text-dim)' }}>KEY_EXCHANGE:</div>
          <div style={{ textAlign: 'right' }}>X25519_ECDH</div>
        </div>
        <div className="divider" style={{ opacity: 0.1, margin: '4px 0' }} />
        <div style={{ fontSize: '9px', color: 'var(--text-dim)', lineHeight: '1.4' }}>
          // INGRESS_TRAFFIC_OBFUSCATION: ENABLED<br/>
          // EXIT_NODE_PRIVACY: VERIFIED
        </div>
      </div>
    </div>
  );
}
