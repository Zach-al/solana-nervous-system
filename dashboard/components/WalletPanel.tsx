'use client';

import { useState } from 'react';

export default function WalletPanel() {
  const [wallet, setWallet] = useState({
    pubkey: '7xkx...8y9z',
    balance: 4.52,
    staked: 1000.00,
    rewards_pending: 12.4,
  });

  const [settling, setSettling] = useState(false);
  const [settled, setSettled] = useState(false);

  const handleClaimAll = async () => {
    if (wallet.rewards_pending === 0 || settling) return;
    
    setSettling(true);
    try {
      // Trigger manual settlement on the daemon
      const nodeUrl = process.env.NEXT_PUBLIC_NODE_URL || 'https://solnet-production.up.railway.app';
      await fetch(`${nodeUrl}/settle`, { method: 'POST' });
      
      // Simulate confirmation delay for UX
      await new Promise(r => setTimeout(r, 2000));
      
      setSettled(true);
      setWallet(prev => ({ ...prev, rewards_pending: 0 }));
      
      // Reset success state after a few seconds
      setTimeout(() => setSettled(false), 5000);
    } catch (e) {
      console.error("Settlement failed", e);
    } finally {
      setSettling(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="panel-header" style={{ borderBottom: 'none', padding: '0 0 8px 0' }}>
        ECONOMIC_CONTROL <span>[WALLET_v1]</span>
      </div>

      <div className="metric-block">
        <div className="metric-label">OPERATOR_WALLET</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ fontFamily: 'var(--font-technical)', fontSize: '13px', fontWeight: 700 }}>{wallet.pubkey}</div>
          <div style={{ fontSize: '10px', color: 'var(--neon-green)', fontWeight: 700 }}>CONNECTED</div>
        </div>
        <div className="divider" style={{ opacity: 0.1, margin: '12px 0' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div className="metric-label">BALANCE</div>
            <div style={{ fontFamily: 'var(--font-technical)', fontSize: '18px', fontWeight: 700 }}>{wallet.balance} SOL</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="metric-label">STAKED</div>
            <div style={{ fontFamily: 'var(--font-technical)', fontSize: '18px', fontWeight: 700, color: 'var(--electric-purple)' }}>{wallet.staked} SNS</div>
          </div>
        </div>
      </div>

      <div className="metric-block">
        <div className="metric-label">UNCLAIMED_REWARDS</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="metric-value" style={{ color: settled ? 'var(--neon-green)' : 'inherit' }}>
            {settled ? 'SUCCESS: MINTED' : `${wallet.rewards_pending} SOLNET`}
          </div>
          <button 
            className="btn-technical" 
            style={{ 
              background: settling ? 'var(--text-dim)' : 'var(--electric-purple)', 
              color: 'white', 
              border: 'none',
              opacity: settling ? 0.6 : 1,
              pointerEvents: settling ? 'none' : 'auto'
            }}
            onClick={handleClaimAll}
          >
            {settling ? '[SETTLING...]' : '[CLAIM_ALL]'}
          </button>
        </div>
      </div>
    </div>
  );
}
