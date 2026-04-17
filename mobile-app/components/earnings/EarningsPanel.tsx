import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Colors, Spacing, Typography } from '../../constants/antigravity';
import GlassCard from '../ui/GlassCard';
import MonoCounter from '../ui/MonoCounter';
import NeonText from '../ui/NeonText';

interface EarningsPanelProps {
  todaySOL: number;
  todayUSD: number;
  lifetimeSOL: number;
  isActive: boolean;
  requestsServed: number;
}

export default function EarningsPanel({
  todaySOL,
  todayUSD,
  lifetimeSOL,
  isActive,
  requestsServed
}: EarningsPanelProps) {
  return (
    <GlassCard glowColor={Colors.greenDim} style={styles.container}>
      {/* Row 1 - Label */}
      <View style={styles.labelRow}>
        <Text style={styles.headerLabel}>EARNINGS</Text>
        {isActive && (
          <View style={styles.liveContainer}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      {/* Row 2 - Primary Counter */}
      <View style={styles.primaryRow}>
        <MonoCounter 
          value={todaySOL} 
          decimals={5} 
          suffix=" SOL" 
          size={40} 
          color={Colors.green} 
        />
      </View>

      {/* Row 3 - Secondary Stats */}
      <View style={styles.secondaryRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>TODAY USD</Text>
          <MonoCounter 
            value={todayUSD} 
            prefix="$" 
            decimals={2} 
            size={18} 
            color={Colors.textPrimary} 
          />
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>LIFETIME</Text>
          <MonoCounter 
            value={lifetimeSOL} 
            suffix=" SOL" 
            decimals={4} 
            size={18} 
            color={Colors.purple} 
          />
        </View>
      </View>

      {/* Row 4 - Network Activity */}
      <View style={styles.requestRow}>
        <Text style={styles.requestText}>
          {`${requestsServed} REQUESTS SERVED THIS SESSION`}
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLabel: {
    ...Typography.monoHeader,
    fontSize: 10,
    letterSpacing: 3,
    color: Colors.textSecondary,
  },
  liveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.green,
    shadowColor: Colors.green,
    shadowRadius: 4,
    shadowOpacity: 0.8,
  },
  liveText: {
    ...Typography.mono,
    fontSize: 10,
    color: Colors.green,
  },
  primaryRow: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    paddingTop: 16,
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    ...Typography.mono,
    fontSize: 10,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  requestRow: {
    marginTop: 4,
  },
  requestText: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'center',
  }
});
