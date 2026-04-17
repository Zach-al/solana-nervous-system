import React from 'react';
import { View, Text, FlatList, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path, LinearGradient, Stop, Defs } from 'react-native-svg';
import { useEarnings } from '../../hooks/useEarnings';
import { Colors, Spacing, Typography, Radius } from '../../constants/antigravity';
import GlassCard from '../../components/earnings/EarningsPanel';
import NeonText from '../../components/ui/NeonText';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 180;
const CHART_PADDING = 20;

export default function EarningsScreen() {
  const { history } = useEarnings();

  // Generate SVG path for the chart
  const getPath = () => {
    if (history.length < 2) return '';
    
    const maxVal = Math.max(...history.map(h => h.lamports), 1e6);
    const stepX = (SCREEN_WIDTH - 80) / (history.length - 1);
    
    return history.reduce((acc, h, i) => {
      const x = i * stepX;
      const y = CHART_HEIGHT - ((h.lamports / maxVal) * (CHART_HEIGHT - CHART_PADDING * 2)) - CHART_PADDING;
      return acc === '' ? `M${x},${y}` : `${acc} L${x},${y}`;
    }, '');
  };

  const chartPath = getPath();

  return (
    <View style={styles.root}>
      {/* Background Decor */}
      <View style={styles.decorContainer} pointerEvents="none">
        <View style={styles.gridLine} />
      </View>

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <NeonText size={28}>REVENUE_LOG</NeonText>
          <Text style={styles.subHeader}>Node settlement history (SOL)</Text>
        </View>

        {/* CUSTOM SVG CHART - STABLE ALTERNATIVE TO VICTORY */}
        <View style={styles.chartWrapper}>
          <View style={styles.chartContainer}>
            <Svg height={CHART_HEIGHT} width={SCREEN_WIDTH - 40}>
              <Defs>
                <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={Colors.green} stopOpacity="0.3" />
                  <Stop offset="1" stopColor={Colors.green} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              
              {/* Data Path */}
              {chartPath ? (
                <>
                  <Path
                    d={chartPath}
                    fill="none"
                    stroke={Colors.green}
                    strokeWidth="3"
                  />
                  {/* Area fill */}
                  <Path
                    d={`${chartPath} L${SCREEN_WIDTH - 80},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`}
                    fill="url(#grad)"
                  />
                </>
              ) : (
                <Path
                  d={`M0,${CHART_HEIGHT/2} L${SCREEN_WIDTH},${CHART_HEIGHT/2}`}
                  stroke={Colors.glassBorder}
                  strokeDasharray="5,5"
                />
              )}
            </Svg>
          </View>
          <View style={styles.chartBaseline} />
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionLabel}>SETTLEMENT_HISTORY</Text>
          <FlatList
            data={history}
            keyExtractor={(_, index) => index.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.logItem}>
                <View style={styles.logMeta}>
                  <Text style={styles.logTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
                  <Text style={styles.logRequests}>{item.requests} REQS</Text>
                </View>
                <View style={styles.rewardColumn}>
                  <Text style={styles.rewardValue}>+{(item.lamports / 1e9).toFixed(5)}</Text>
                  <Text style={styles.currency}>SOL</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>[ AWAITING_DATA ]</Text>
              </View>
            }
          />
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
  decorContainer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
  },
  gridLine: {
    height: 1,
    backgroundColor: Colors.cyan,
    marginTop: 200,
    width: '100%',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 32,
  },
  subHeader: {
    ...Typography.mono,
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
    letterSpacing: 1,
  },
  chartWrapper: {
    height: CHART_HEIGHT + 40,
    marginBottom: 20,
    justifyContent: 'center',
  },
  chartContainer: {
    height: CHART_HEIGHT,
    backgroundColor: 'rgba(0, 255, 136, 0.02)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0, 255, 136, 0.2)',
  },
  chartBaseline: {
    height: 1,
    backgroundColor: 'rgba(0, 255, 136, 0.3)',
    marginTop: -1,
  },
  listSection: {
    flex: 1,
  },
  sectionLabel: {
    ...Typography.monoHeader,
    fontSize: 9,
    letterSpacing: 3,
    color: Colors.textTertiary,
    marginBottom: 16,
  },
  listContent: {
    gap: 12,
    paddingBottom: 40,
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.md,
  },
  logMeta: {
    gap: 4,
  },
  logTime: {
    ...Typography.mono,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  logRequests: {
    ...Typography.mono,
    fontSize: 9,
    color: Colors.textTertiary,
  },
  rewardColumn: {
    alignItems: 'flex-end',
  },
  rewardValue: {
    ...Typography.mono,
    fontSize: 14,
    color: Colors.green,
    fontWeight: '700',
  },
  currency: {
    ...Typography.mono,
    fontSize: 9,
    color: Colors.textSecondary,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.mono,
    color: Colors.textTertiary,
    fontSize: 12,
  }
});
