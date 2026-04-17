import { View, Text } from 'react-native';

export function EarningsCounter({ lamports, requests }: { lamports: number, requests: number }) {
  const solValue = (lamports / 1e9).toFixed(5);
  const usdValue = ((lamports / 1e9) * 180).toFixed(2); // Mock SOL price $180

  return (
    <View className="bg-surface border border-border p-6 rounded-2xl w-full mb-6">
      <Text className="text-textSecondary mb-2 text-lg">Earnings Today</Text>
      <Text className="text-primary text-4xl font-bold mb-1">{solValue} SOL</Text>
      <Text className="text-textSecondary text-lg mb-4">≈ ${usdValue} today</Text>
      
      <View className="bg-background rounded-lg p-3">
        <Text className="text-textTertiary text-sm text-center">Based on {requests} requests served</Text>
      </View>
    </View>
  );
}
