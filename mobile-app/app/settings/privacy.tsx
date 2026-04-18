import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '../../constants/antigravity';
import { ChevronLeft } from 'lucide-react-native';
import NeonText from '../../components/ui/NeonText';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color={Colors.cyan} size={28} />
        </TouchableOpacity>
        <NeonText color={Colors.cyan} size={20}>PRIVACY PROTOCOL</NeonText>
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>LAST UPDATED: APRIL 2026</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. DECENTRALIZED IDENTITY</Text>
          <Text style={styles.body}>
            SOLNET is built on the principle of absolute anonymity. We do not collect names, 
            emails, or phone numbers. Your identity is tied exclusively to your Solana 
            wallet address via Zero-Knowledge (ZK) proofs.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. DATA ENCAPSULATION</Text>
          <Text style={styles.body}>
            All RPC requests forwarded through your node are end-to-end encrypted. 
            The Rust engine (libsolnet_native) ensures that data is processed in-memory 
            and never persisted to local storage in a readable format.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. NETWORK TELEMETRY</Text>
          <Text style={styles.body}>
            Minimal telemetry (uptime, requests served) is broadcast to the Mesh 
            Coordinator to calculate your SOL rewards. This data is stripped of 
            IP addresses and device identifiers before reaching the validator set.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. HARDWARE SECURITY</Text>
          <Text style={styles.body}>
            We utilize Android Keystore and Apple Keychain to secure your session 
            entropy. Private keys never leave the hardware-backed secure enclave 
            of your device.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By operating a SOLNET node, you agree to the decentralized governance 
            protocols of the Solana Nervous System DAO.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  backButton: {
    marginRight: 16,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  lastUpdated: {
    ...Typography.mono,
    fontSize: 10,
    color: Colors.textTertiary,
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    ...Typography.monoHeader,
    fontSize: 14,
    color: Colors.cyan,
    marginBottom: 12,
    letterSpacing: 1,
  },
  body: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  footer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: Colors.glass,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  footerText: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
