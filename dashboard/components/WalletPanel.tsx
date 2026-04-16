'use client';

import { useState, useEffect } from 'react';
import { secureFetch } from '../lib/secure-fetch';

export default function WalletPanel() {
  const [wallet, setWallet] = useState({
    pubkey: 'SNS_LOADING...',
    balance: 0,
    staked: 0,
    rewards_pending: 0,
  });

  const [settling, setSettling] = useState(false);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const res = await secureFetch('/api/daemon/wallet');
        if (res.ok) {
          const data = await res.json();
          setWallet({
            pubkey: data.wallet_address,
            balance: data.confirmed_wallet_balance_sol,
            staked: data.lifetime_earned_sol,
            rewards_pending: data.pending_sol,
          });
          setError(false);
        } else {
          setError(true);
        }
      } catch (err) {
        setError(true);
        console.error('Failed to fetch wallet status', err);
      }
    };
    fetchWallet();
    const interval = setInterval(fetchWallet, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClaimAll = async () => {
    if (wallet.rewards_pending === 0 || settling) return;
    
    setSettling(true);
    try {
      // Trigger manual settlement on the daemon via unified proxy
      const res = await secureFetch('/api/daemon/settle', { method: 'POST' });
      
      if (res.ok) {
        setSettled(true);
        setWallet(prev => ({ ...prev, rewards_pending: 0 }));
        // Reset success state after a few seconds
        setTimeout(() => setSettled(false), 5000);
      }
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
          <div style={{ fontFamily: 'var(--font-technical)', fontSize: '13px', fontWeight: 700, color: error ? '#ef4444' : 'inherit' }}>
            {error ? 'NODE_OFFLINE' : wallet.pubkey}
          </div>
          <div style={{ fontSize: '10px', color: error ? '#ef4444' : 'var(--neon-green)', fontWeight: 700 }}>
            {error ? 'DISCONNECTED' : 'CONNECTED'}
          </div>
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
