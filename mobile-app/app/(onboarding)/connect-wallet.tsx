import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useWallet } from '../../hooks/useWallet';
import { Colors, Spacing, Typography, Radius } from '../../constants/antigravity';
import NeonText from '../../components/ui/NeonText';
import PressButton from '../../components/ui/PressButton';
import GlassCard from '../../components/ui/GlassCard';

export default function ConnectWalletScreen() {
  const router = useRouter();
  const { connect, generateLocal } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      await connect();
      router.push('/start-node');
    } catch (e: any) {
      console.warn('Wallet connection bypassed:', e.message);
      await handleGenerate();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      await generateLocal();
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
