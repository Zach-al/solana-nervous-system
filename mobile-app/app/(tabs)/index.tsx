import { SafeAreaView, View, Text, ScrollView } from 'react-native';
import { useNodeStatus } from '../../hooks/useNodeStatus';
import { useEarnings } from '../../hooks/useEarnings';
import { useNodeStore } from '../../stores/nodeStore';
import { NodeStatusCard } from '../../components/node/NodeStatusCard';
import { EarningsCounter } from '../../components/earnings/EarningsCounter';

export default function DashboardScreen() {
  useNodeStatus(); 
  const { isActive, isOnline, uptimeSeconds, setActive, requestsServed } = useNodeStore();
  const { todayLamports, lifetimeLamports } = useEarnings();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6 pt-12">
        <View className="flex-row justify-between items-center mb-8">
        <Text className="text-white text-3xl font-bold">SOLNET</Text>
        <View className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center">
          <Text className="text-primary font-bold">SN</Text>
        </View>
      </View>

      <NodeStatusCard 
        active={isActive} 
        isOnline={isOnline} 
        uptimeSeconds={uptimeSeconds} 
        onToggle={() => setActive(!isActive)} 
      />

      <EarningsCounter lamports={todayLamports} requests={requestsServed} />

      <View className="bg-surface border border-border p-6 rounded-2xl mb-6">
        <Text className="text-textSecondary mb-2">Lifetime Earnings</Text>
        <Text className="text-white text-2xl font-bold">{(lifetimeLamports / 1e9).toFixed(5)} SOL</Text>
      </View>

      <View className="flex-row justify-between mb-8">
        <View className="bg-surface border border-border p-4 rounded-xl flex-1 mr-2">
          <Text className="text-textSecondary text-sm mb-1">Total Requests</Text>
          <Text className="text-white text-xl font-bold">{requestsServed}</Text>
        </View>
        <View className="bg-surface border border-border p-4 rounded-xl flex-1 ml-2">
          <Text className="text-textSecondary text-sm mb-1">Rank</Text>
          <Text className="text-white text-xl font-bold">Top 12%</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
