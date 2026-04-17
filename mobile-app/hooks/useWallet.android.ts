import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { PublicKey, Keypair } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol';

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
    try {
      if (Platform.OS === 'ios') {
        throw new Error('MWA unsupported on iOS. Bypassing to local generation fallback.');
      }
      await transact(async (wallet) => {
        const { accounts } = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: {
            name: 'SOLNET',
            icon: 'favicon.ico',
          },
        });
        // The MWA protocol returns the public key bytes encoded as base64 in the `address` field
        const addressBase64 = accounts[0].address;
        const pubkeyBytes = Buffer.from(addressBase64, 'base64');
        const address = new PublicKey(pubkeyBytes).toBase58();
        setPublicKey(new PublicKey(address));
        setConnected(true);
        await SecureStore.setItemAsync('solnet_wallet_pubkey', address);
      });
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, []);

  const generateLocal = useCallback(async () => {
    const kp = Keypair.generate();
    const address = kp.publicKey.toBase58();
    // store secret safely
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
