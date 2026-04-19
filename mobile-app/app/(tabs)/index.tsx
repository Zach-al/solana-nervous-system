import React, { useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  ScrollView, 
  Dimensions, 
  TouchableOpacity,
  Text 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNodeStatus } from '../../hooks/useNodeStatus';
import { useNodeStore } from '../../stores/nodeStore';
import { useEarningsStore } from '../../stores/earningsStore';
import { useWallet } from '../../hooks/useWallet';
import { useRouter } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '../../constants/antigravity';
import { CONFIG } from '../../constants/theme';
import { useDeviceGovernor } from '../../hooks/useDeviceGovernor';
import { useLocalNodeStats } from '../../hooks/useLocalNodeStats';
import { DaemonBridge } from '../../services/DaemonBridge';

// Components
import ReactorCore from '../../components/node/ReactorCore';
import EarningsPanel from '../../components/earnings/EarningsPanel';
import SwipeToActivate from '../../components/node/SwipeToActivate';
import PressButton from '../../components/ui/PressButton';
import TerminalFeed from '../../components/terminal/TerminalFeed';
import NodeRankBadge from '../../components/node/NodeRankBadge';
import NeonText from '../../components/ui/NeonText';
import MonoCounter from '../../components/ui/MonoCounter';
import GlassCard from '../../components/ui/GlassCard';

// Icons
import { CircleUser, Pause, Zap, WifiOff } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const THROTTLE_COLORS: Record<string, string> = {
  FULL_POWER: Colors.cyan,
  CONSERVE: '#f5a623',
  STANDBY: '#ff6b6b',
};

export default function DashboardScreen() {
  const router = useRouter();
  const { isActive, nodeId, requestsServed, uptimeSeconds, setActive } = useNodeStore();
  const { todayLamports, lifetimeLamports } = useEarningsStore();
  const { address, truncatedAddress } = useWallet();
  const deviceState = useDeviceGovernor();

  // Refresh stats (Server + Local Native Engine)
  useNodeStatus();
  useLocalNodeStats();

  useEffect(() => {
    if (!deviceState.isReady) return;
    DaemonBridge.setThrottleState(deviceState.throttleState).catch((err) =>
      console.warn('[DaemonBridge] setThrottleState failed:', err)
    );
  }, [deviceState.throttleState, deviceState.isReady]);

  // ── Native Relay Activation ──
  useEffect(() => {
    // Only attempt to start if we have a wallet address and not in stub mode (if strict check desired)
    // However, DaemonBridge handles IS_STUB internally by returning { ok: false, isStub: true }
    if (!address) return;

    if (isActive) {
      DaemonBridge.start({
        relay_url: CONFIG.SOLNET_API_URL,
        wallet_pubkey: address,
      }).catch((err) => {
        console.error('[DaemonBridge] Activation failed:', err);
      });
    } else {
      DaemonBridge.stop().catch((err) => {
        console.error('[DaemonBridge] Deactivation failed:', err);
      });
    }
  }, [isActive, address]);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      
      {/* Scanline CRT Background Effect */}
      <View style={styles.backgroundContainer} pointerEvents="none">
        {Array.from({ length: 200 }).map((_, i) => (
          <View key={i} style={styles.scanline} />
        ))}
      </View>

      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ZONE 1: HEADER */}
          <View style={styles.header}>
            <View>
              <NeonText 
                color={isActive ? Colors.green : Colors.cyan} 
                size={28} 
                letterSpacing={2}
              >
                SOLNET
              </NeonText>
              {requestsServed > 0 && <NodeRankBadge requestsServed={requestsServed} />}
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/settings')}
              style={styles.avatarButton}
            >
              <Text style={styles.addressLabel}>{truncatedAddress || '0x...'}</Text>
              <CircleUser color={Colors.cyan} size={24} />
            </TouchableOpacity>
          </View>

          {/* POWER MODE BADGE */}
          {deviceState.isReady && (
            <View style={[styles.powerBadge, { borderColor: THROTTLE_COLORS[deviceState.throttleState] }]}>
              <Zap size={10} color={THROTTLE_COLORS[deviceState.throttleState]} />
              <Text style={[styles.powerBadgeText, { color: THROTTLE_COLORS[deviceState.throttleState] }]}>
                {deviceState.throttleState === 'FULL_POWER' ? 'FULL POWER' :
                 deviceState.throttleState === 'CONSERVE' ? 'CONSERVING' : 'STANDBY'}{' '}
                · {Math.round(deviceState.batteryLevel * 100)}%
              </Text>
            </View>
          )}

          {/* STANDBY WARNING */}
          {deviceState.isReady && deviceState.throttleState === 'STANDBY' && (
            <View style={styles.standbyWarning}>
              <WifiOff size={14} color="#ff6b6b" />
              <Text style={styles.standbyText}>
                Heartbeat mode — connect to WiFi or plug in for full throughput
              </Text>
            </View>
          )}

          <View style={styles.reactorContainer}>
            <ReactorCore 
              status={isActive ? 'active' : 'idle'} 
              onPress={() => setActive(!isActive)} 
            />
          </View>

          <View style={styles.coreStatsWrapper}>
            <GlassCard style={styles.statsRow}>
              <View style={styles.miniStat}>
                <Text style={styles.miniLabel}>UPTIME</Text>
                <Text style={styles.miniValue}>{formatUptime(uptimeSeconds)}</Text>
              </View>
              <View style={[styles.miniStat, styles.borderLeft]}>
                <Text style={styles.miniLabel}>REQUESTS</Text>
                <MonoCounter 
                   value={requestsServed} 
                   decimals={0} 
                   size={18} 
                   color={Colors.textPrimary} 
                />
              </View>
            </GlassCard>
          </View>

          {/* ZONE 3: EARNINGS PANEL */}
          <View style={styles.section}>
            <EarningsPanel 
              todaySOL={todayLamports / 1e9}
              todayUSD={(todayLamports / 1e9) * 150} // Mock price
              lifetimeSOL={lifetimeLamports / 1e9}
              isActive={isActive}
              requestsServed={requestsServed}
            />
          </View>

          {/* ZONE 4: ACTIVATE / DEACTIVATE */}
          <View style={styles.section}>
            {!isActive ? (
              <SwipeToActivate onActivate={() => setActive(true)} />
            ) : (
              <PressButton 
                label="PAUSE NODE" 
                variant="ghost" 
                haptic="medium"
                icon={<Pause color={Colors.textSecondary} size={20} />}
                onPress={() => setActive(false)} 
              />
            )}
          </View>

          {/* ZONE 5: TERMINAL FEED */}
          <View style={styles.section}>
            <TerminalFeed isActive={isActive} nodeId={nodeId} />
          </View>

          {/* ZONE 6: NETWORK STATS STRIP */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.statsStrip}
            contentContainerStyle={styles.statsStripContent}
          >
            <GlassCard style={styles.miniCard}>
              <Text style={styles.miniCardLabel}>PEERS</Text>
              <Text style={styles.miniCardValue}>{isActive ? '24' : '0'}</Text>
            </GlassCard>
            <GlassCard style={styles.miniCard}>
              <Text style={styles.miniCardLabel}>LATENCY</Text>
              <Text style={styles.miniCardValue}>42MS</Text>
            </GlassCard>
            <GlassCard style={styles.miniCard}>
              <Text style={styles.miniCardLabel}>REGION</Text>
              <Text style={styles.miniCardValue}>SGP</Text>
            </GlassCard>
          </ScrollView>

        </ScrollView>
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
    opacity: 0.15,
  },
  scanline: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 3,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.glass,
  },
  addressLabel: {
    ...Typography.mono,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  reactorContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  coreStatsWrapper: {
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    padding: 0,
    paddingVertical: 12,
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
  },
  borderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.glassBorder,
  },
  miniLabel: {
    ...Typography.mono,
    fontSize: 9,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  miniValue: {
    ...Typography.mono,
    fontSize: 18,
    color: Colors.textPrimary,
  },
  section: {
    marginBottom: 20,
  },
  statsStrip: {
    marginTop: 10,
  },
  statsStripContent: {
    gap: 12,
  },
  miniCard: {
    width: 120,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  miniCardLabel: {
    ...Typography.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  miniCardValue: {
    ...Typography.mono,
    fontSize: 16,
    color: Colors.cyan,
  },
  powerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  powerBadgeText: {
    ...Typography.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  standbyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  standbyText: {
    ...Typography.mono,
    fontSize: 11,
    color: '#ff6b6b',
    flex: 1,
  },
});
