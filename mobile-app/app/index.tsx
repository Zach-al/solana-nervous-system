import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('solnet_wallet_pubkey').then((v) => {
      setHasWallet(!!v);
      setReady(true);
    });
  }, []);

  if (!ready) return null;
  return <Redirect href={hasWallet ? '/(tabs)' : '/(onboarding)/welcome'} />;
}
