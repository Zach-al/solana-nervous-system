import { SafeAreaView, View, Text } from 'react-native';
import { useNodeStore } from '../../stores/nodeStore';

export default function NetworkScreen() {
  const { nodeId } = useNodeStore();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-12">
      <Text className="text-white text-3xl font-bold mb-8">Network</Text>

      <View className="bg-surface border border-border p-6 rounded-2xl mb-6">
        <Text className="text-textSecondary mb-4">Your Node Identity</Text>
        <View className="mb-4">
          <Text className="text-textTertiary text-xs">NODE ID</Text>
          <Text className="text-white font-mono text-sm">{nodeId || 'Connecting...'}</Text>
        </View>
        <View>
          <Text className="text-textTertiary text-xs">REGION (DELEGATED)</Text>
          <Text className="text-white font-bold">asia-southeast1</Text>
        </View>
      </View>

      <View className="flex-row justify-between mb-4">
        <View className="bg-surface border border-border p-4 rounded-xl flex-1 mr-2">
          <Text className="text-textSecondary text-sm mb-1">Global Nodes</Text>
          <Text className="text-primary text-xl font-bold">1,204</Text>
        </View>
        <View className="bg-surface border border-border p-4 rounded-xl flex-1 ml-2">
          <Text className="text-textSecondary text-sm mb-1">Avg Latency</Text>
          <Text className="text-white text-xl font-bold">42 ms</Text>
        </View>
      </View>
      </View>
    </SafeAreaView>
  );
}
