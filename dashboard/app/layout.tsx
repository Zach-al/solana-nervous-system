import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SOLNET — Decentralized RPC Infrastructure for Solana',
  description:
    'Self-healing P2P mesh network replacing centralized Solana RPC providers. Privacy-first, node-incentivized, open source.',
  keywords: ['Solana', 'RPC', 'decentralized', 'DePIN', 'mesh network', 'Web3', 'SOLNET'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
