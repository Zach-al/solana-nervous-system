'use client';

import { useState } from 'react';

export default function PrivacyPanel() {
    const [onionEnabled, setOnionEnabled] = useState(true);
    const [ipObfuscation, setIpObfuscation] = useState(true);

    const stats = {
        onion_requests: 124,
        total_requests: 156,
        privacy_score: 92,
    };

    return (
        <div className="privacy-panel" style={{
            background: 'rgba(10, 10, 15, 0.6)',
            border: '1px solid var(--purple-dim)',
            padding: '20px',
            borderRadius: '12px',
            fontFamily: 'monospace',
            color: 'var(--text-primary)',
            marginTop: '20px',
            boxShadow: '0 8px 32px rgba(153, 69, 255, 0.1)'
        }}>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '20px'
            }}>
                <div style={{ fontSize: '12px', color: 'var(--purple-primary)', letterSpacing: '0.15em' }}>
                    // PRIVACY SHIELD [V0.4]
                </div>
                <div style={{ 
                    fontSize: '10px', 
                    background: 'rgba(0, 255, 136, 0.1)', 
                    color: 'var(--green-primary)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(0, 255, 136, 0.2)'
                }}>
                    MILITARY GRADE
                </div>
            </div>

            <div className="toggle-group" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px' }}>Onion Routing</span>
                    <button 
                        onClick={() => setOnionEnabled(!onionEnabled)}
                        style={{
                            background: onionEnabled ? 'var(--purple-primary)' : '#333',
                            border: 'none',
                            width: '40px',
                            height: '20px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <div style={{
                            width: '16px',
                            height: '16px',
                            background: '#fff',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '2px',
                            left: onionEnabled ? '22px' : '2px',
                            transition: 'all 0.3s ease'
                        }} />
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px' }}>IP Obfuscation</span>
                    <div style={{ color: ipObfuscation ? 'var(--green-primary)' : 'var(--amber)', fontSize: '13px' }}>
                        {ipObfuscation ? 'ACTIVE' : 'DISABLED'}
                    </div>
                </div>
            </div>

            <div style={{ margin: '20px 0', padding: '15px 0', borderTop: '1px solid rgba(153, 69, 255, 0.1)' }}>
                <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '5px' }}>PRIVACY SCORE</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                            flex: 1, 
                            height: '4px', 
                            background: '#222', 
                            borderRadius: '2px', 
                            overflow: 'hidden' 
                        }}>
                            <div style={{ 
                                width: `${stats.privacy_score}%`, 
                                height: '100%', 
                                background: 'linear-gradient(90deg, var(--purple-primary), var(--green-primary))'
                            }} />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--purple-primary)' }}>{stats.privacy_score}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Onion Traffic:</span>
                    <span>{stats.onion_requests} / {stats.total_requests}</span>
                </div>
            </div>

            <div style={{ 
                fontSize: '10px', 
                background: 'rgba(0, 255, 136, 0.05)', 
                padding: '12px', 
                borderRadius: '8px',
                border: '1px solid rgba(0, 255, 136, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <span style={{ fontSize: '14px' }}>🛡️</span>
                <span style={{ color: 'var(--green-primary)', opacity: 0.8 }}>Your IP is never stored or logged in simple-text.</span>
            </div>
        </div>
    );
}
