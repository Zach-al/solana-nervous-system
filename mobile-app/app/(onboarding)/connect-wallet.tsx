import React, { useState } from 'react';
import { StyleSheet, View, Text, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useWallet } from '@/hooks/useWallet';
import { Colors, Spacing, Typography, Radius } from '@/constants/antigravity';
import GlassCard from '@/components/ui/GlassCard';
import NeonText from '@/components/ui/NeonText';
import PressButton from '@/components/ui/PressButton';
import * as SecureStore from 'expo-secure-store';

// ── LAZY MODULES ─────────────────────────────────────────────────────────────
// We use lazy requires inside functions to prevent "Invariant Violation" 
// errors on devices where these native modules are not linked at boot.
let _MWA: any = null;
let _Web3: any = null;

const getMWA = () => {
  if (!_MWA) _MWA = require('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
  return _MWA;
};

const getWeb3 = () => {
  if (!_Web3) _Web3 = require('@solana/web3.js');
  return _Web3;
};

export default function ConnectWalletScreen() {
  const router = useRouter();
  const { address, refreshWallet } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const addressStr = typeof address === 'string' ? address : '';
  const isWalletApp = !!addressStr;

  const handleConnect = async () => {
    // Mobile Wallet Adapter (MWA) is only supported on physical Android devices.
    // For the demo and iOS, we default to the secure local keypair generation
    // which use the SolnetNative bridge.
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Platform Note',
        'Mobile Wallet Adapter is primarily an Android feature for Phantom. On iOS, we use a secure local vault.',
        [{ text: 'Proceed', onPress: handleGenerate }]
      );
      return;
    }

    setIsConnecting(true);
    try {
      if (Platform.OS === 'android') {
        const { transact } = getMWA();
        const { PublicKey } = getWeb3();

        await transact(async (wallet: any) => {
          const auth = await wallet.authorize({
            cluster: 'mainnet-beta',
            identity: { name: 'SOLNET Node', uri: 'https://solnet.io' }
          });
          
          const pubkey = new PublicKey(auth.accounts[0].address).toBase58();
          const keypairJson = JSON.stringify({ publicKey: pubkey, secretKey: '' });
          
          await SecureStore.setItemAsync('solnet_v2_wallet', keypairJson);
          await refreshWallet();

          // Hardened Navigation: Wait for native modal to dismiss
          setTimeout(() => {
             router.push('/start-node');
          }, 500);
        });
      } else {
        // Fallback for iOS / Simulation
        await handleGenerate();
      }
    } catch (e: any) {
      console.warn('[MWA] Transaction failed:', e);
      Alert.alert('Connection Error', 'Phantom wallet was not found or the request was denied.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      await refreshWallet();
      router.push('/start-node');
    } catch (e) {
      console.warn('Local generation failed', e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.backgroundContainer} pointerEvents="none">
        {Array.from({ length: 150 }).map((_, i) => (
          <View key={i} style={styles.scanline} />
        ))}
      </View>

      <SafeAreaView style={styles.container}>
        <View style={styles.topSection}>
          <NeonText size={32} style={styles.heading}>AUTHENTICATION</NeonText>
          <Text style={styles.subheading}>Secure your node's earning channel.</Text>
        </View>

        <View style={styles.content}>
          <GlassCard style={styles.card}>
            <Text style={styles.cardText}>
              Your node ID must be linked to a Solana address to settle batch rewards.
              SOLNET never stores your private keys.
            </Text>
          </GlassCard>

          <View style={styles.buttonGroup}>
            <PressButton 
              label={isConnecting ? "CONNECTING..." : "CONNECT MOBILE WALLET"}
              onPress={handleConnect}
              variant="primary"
              loading={isConnecting}
            />
            
            {isWalletApp && (
              <Text style={{ color: '#00f0ff', textAlign: 'center',
                             fontFamily: 'monospace', fontSize: 10,
                             marginTop: 8, letterSpacing: 1 }}>
                ✓ PHANTOM CONNECTED
              </Text>
            )}

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.line} />
            </View>

            <PressButton 
              label="INITIALIZE LOCAL KEYPAIR"
              onPress={handleGenerate}
              variant="ghost"
              loading={isGenerating}
            />

            {isWalletApp && (
              <PressButton 
                label="CONTINUE TO NODE SETUP →"
                onPress={() => router.push('/start-node')}
                variant="primary"
                style={{ marginTop: 24, backgroundColor: 'rgba(0, 255, 136, 0.1)', borderColor: '#00ff88' }}
              />
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            NON-CUSTODIAL INFRASTRUCTURE PROTOCOL
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
  },
  scanline: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 6,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  topSection: {
    marginTop: 40,
    marginBottom: 60,
  },
  heading: {
    marginBottom: Spacing.xs,
  },
  subheading: {
    ...Typography.ui,
    color: Colors.textSecondary,
    fontSize: 16,
  },
  content: {
    flex: 1,
    gap: 32,
  },
  card: {
    backgroundColor: 'rgba(0, 240, 255, 0.03)',
    borderColor: 'rgba(0, 240, 255, 0.15)',
  },
  cardText: {
    ...Typography.ui,
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  buttonGroup: {
    gap: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.glassBorder,
  },
  dividerText: {
    ...Typography.mono,
    fontSize: 10,
    color: Colors.textTertiary,
  },
  footer: {
    marginTop: 'auto',
  },
  footerText: {
    ...Typography.mono,
    fontSize: 9,
    color: Colors.textTertiary,
    textAlign: 'center',
    letterSpacing: 2,
  }
});
