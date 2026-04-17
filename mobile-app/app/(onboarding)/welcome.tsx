import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, Radius } from '../../constants/antigravity';
import ReactorCore from '../../components/node/ReactorCore';
import NeonText from '../../components/ui/NeonText';
import PressButton from '../../components/ui/PressButton';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      {/* Scanline Background */}
      <View style={styles.backgroundContainer} pointerEvents="none">
        {Array.from({ length: 200 }).map((_, i) => (
          <View key={i} style={styles.scanline} />
        ))}
      </View>

      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.reactorWrapper}>
            <ReactorCore 
              status="idle" 
              onPress={() => {}} // No-op for welcome
            />
          </View>
          
          <View style={styles.textWrapper}>
            <NeonText size={32} style={styles.heading}>
              Your phone.{"\n"}Your node.{"\n"}Your SOL.
            </NeonText>
            <Text style={styles.subheading}>
              Earn passive income by routing Solana traffic through your mobile hardware.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <PressButton 
            label="GET STARTED"
            onPress={() => router.push('/connect-wallet')}
            variant="primary"
          />
          <Text style={styles.legalText}>v1.0.0 | SECURE INFRASTRUCTURE</Text>
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
    marginBottom: 4,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: Spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactorWrapper: {
    marginBottom: 60,
  },
  textWrapper: {
    alignItems: 'center',
  },
  heading: {
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subheading: {
    ...Typography.ui,
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  footer: {
    width: '100%',
    gap: 16,
  },
  legalText: {
    ...Typography.mono,
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'center',
    letterSpacing: 2,
  }
});
