import { useState, useCallback, useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import bs58 from 'bs58';

const { SolnetNative } = NativeModules;

export interface Wallet {
  publicKey: string;
  secretKey: string;
}

export function useWallet() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWallet = useCallback(async () => {
    try {
      setLoading(true);
      
      const stored = await SecureStore.getItemAsync('solnet_v2_wallet');
      if (stored) {
        setWallet(JSON.parse(stored));
        return;
      }

      if (!SolnetNative) {
        console.warn('[useWallet] Native module SolnetNative not found. Falling back to stub mode.');
        setWallet(null);
        return;
      }

      const keypairJson = await SolnetNative.generateKeypair();
      const parsed = JSON.parse(keypairJson);
      
      await SecureStore.setItemAsync('solnet_v2_wallet', keypairJson);
      setWallet(parsed);
      
    } catch (err) {
      console.error('FAILED TO LOAD NATIVE WALLET:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const disconnect = useCallback(async () => {
    await SecureStore.deleteItemAsync('solnet_v2_wallet');
    setWallet(null);
  }, []);

  const signTransaction = useCallback(async (message: string) => {
    if (!wallet || !SolnetNative) return null;
    try {
      return await SolnetNative.signTransaction(wallet.secretKey, message);
    } catch (err) {
      console.error('NATIVE SIGNING FAILED:', err);
      return null;
    }
  }, [wallet]);

  // Backward compatibility helpers & Encoding normalization
  // The native bridge might return Hex (64 chars), but we need Base58 (32-44 chars)
  const address = (() => {
    if (!wallet?.publicKey) return '';
    if (wallet.publicKey.length === 64) {
      try {
        const bytes = Buffer.from(wallet.publicKey, 'hex');
        return bs58.encode(bytes);
      } catch {
        return wallet.publicKey;
      }
    }
    return wallet.publicKey;
  })();

  const truncatedAddress = address ? `${address.slice(0, 4)}...${address.slice(-4)}` : '';

  return {
    wallet,
    address,
    truncatedAddress,
    loading,
    disconnect,
    signTransaction,
    refreshWallet: loadWallet
  };
}
