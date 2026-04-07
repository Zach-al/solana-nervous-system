import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SNS // Solana Nervous System — Decentralized RPC Mesh',
  description:
    'Real-time dashboard for the Solana Nervous System — a decentralized peer-to-peer RPC mesh network. Monitor node earnings, global mesh topology, and live request activity.',
  keywords: ['Solana', 'RPC', 'decentralized', 'mesh network', 'Web3', 'SNS'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
