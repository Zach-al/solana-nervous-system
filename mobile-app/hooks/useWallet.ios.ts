import { useState, useCallback, useEffect } from 'react';
import { PublicKey, Keypair } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';

export function useWallet() {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('solnet_wallet_pubkey').then((stored) => {
      if (stored) {
        setPublicKey(new PublicKey(stored));
        setConnected(true);
      }
    });
  }, []);

  const connect = useCallback(async () => {
    // Force fallback to generateLocal in the UI by throwing expected error
    throw new Error('MWA unsupported on iOS. Bypassing to local generation fallback.');
  }, []);

  const generateLocal = useCallback(async () => {
    const kp = Keypair.generate();
    const address = kp.publicKey.toBase58();
    const secretStr = JSON.stringify(Array.from(kp.secretKey));
    
    await SecureStore.setItemAsync('solnet_keypair', secretStr);
    await SecureStore.setItemAsync('solnet_wallet_pubkey', address);
    
    setPublicKey(kp.publicKey);
    setConnected(true);
    return kp;
  }, []);

  const disconnect = useCallback(async () => {
    await SecureStore.deleteItemAsync('solnet_wallet_pubkey');
    await SecureStore.deleteItemAsync('solnet_keypair');
    setPublicKey(null);
    setConnected(false);
  }, []);

  return {
    publicKey,
    address: publicKey?.toBase58() || null,
    truncatedAddress: publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : null,
    connected,
    connect,
    generateLocal,
    disconnect
  };
}
