import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useWallet } from '../../hooks/useWallet';
import { registerNode } from '../../services/solnetApi';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNodeStore } from '../../stores/nodeStore';
import * as Crypto from 'expo-crypto';
import { Colors, Spacing, Typography, Radius } from '../../constants/antigravity';
import NeonText from '../../components/ui/NeonText';
import GlassCard from '../../components/ui/GlassCard';
import SwipeToActivate from '../../components/node/SwipeToActivate';

export default function StartNodeScreen() {
  const router = useRouter();
  const { address } = useWallet();
  const { setNodeId } = useNodeStore();
  const [isInitializing, setIsInitializing] = useState(false);

  const activateNode = async () => {
    if (!address || isInitializing) return;
    try {
      setIsInitializing(true);
      const deviceId = Crypto.randomUUID();
      const res = await registerNode(address, deviceId);
      
      if (res.success) {
        await SecureStore.setItemAsync('solnet_node_id', res.node_id);
        setNodeId(res.node_id);
        await AsyncStorage.setItem('onboarding_complete', 'true');
        router.replace('/(tabs)');
      }
    } catch (e) {
      console.error(e);
      // Hard fallback to enter the app even if registration fails temporarily
      await AsyncStorage.setItem('onboarding_complete', 'true');
      router.replace('/(tabs)');
    } finally {
      setIsInitializing(false);
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
          <NeonText size={32} style={styles.heading}>FINALIZATION</NeonText>
          <Text style={styles.subheading}>Registering device on the mesh network.</Text>
        </View>

        <View style={styles.content}>
          <GlassCard glowColor={Colors.purpleDim} style={styles.card}>
            <Text style={styles.label}>ASSIGNED WALLET</Text>
            <Text style={styles.addressText}>{address || '0x...'}</Text>
          </GlassCard>

          <View style={styles.estimationCard}>
             <Text style={styles.estimateLabel}>ESTIMATED THROUGHPUT</Text>
             <Text style={styles.estimateValue}>LOW LATENCY EDGE</Text>
             <Text style={styles.legalNotice}>
               By starting the node, you agree to route encrypted RPC traffic according to the SOLNET protocol.
             </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <SwipeToActivate 
            onActivate={activateNode}
            label="SWIPE TO IGNITE NODE →"
          />
          <Text style={styles.versionText}>SYSTEM v1.0.0 | P2P LAYER: LIBP2P</Text>
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
    marginBottom: 40,
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
    gap: 20,
  },
  card: {
    gap: 8,
  },
  label: {
    ...Typography.mono,
    fontSize: 10,
    color: Colors.textTertiary,
  },
  addressText: {
    ...Typography.mono,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  estimationCard: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  estimateLabel: {
    ...Typography.mono,
    fontSize: 10,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  estimateValue: {
    ...Typography.ui,
    fontSize: 18,
    color: Colors.cyan,
    marginBottom: 20,
    fontWeight: '700',
  },
  legalNotice: {
    ...Typography.ui,
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    marginTop: 'auto',
    gap: 16,
  },
  versionText: {
    ...Typography.mono,
    fontSize: 8,
    color: Colors.textTertiary,
    textAlign: 'center',
    letterSpacing: 1,
  }
});
