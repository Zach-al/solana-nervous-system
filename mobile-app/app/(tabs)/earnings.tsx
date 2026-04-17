import { SafeAreaView, View, Text, FlatList } from 'react-native';
import { useEarnings } from '../../hooks/useEarnings';
import { VictoryLine, VictoryChart, VictoryTheme, VictoryAxis } from 'victory-native';

export default function EarningsScreen() {
  const { history } = useEarnings();

  const chartData = history.length > 0 ? history.map((h, i) => ({
    x: i,
    y: h.lamports / 1e9
  })) : [{x: 0, y: 0}, {x: 1, y: 0}];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-12">
      <Text className="text-white text-3xl font-bold mb-8">Earnings</Text>

      <View className="bg-surface border border-border p-4 rounded-2xl w-full mb-6 items-center">
        <VictoryChart theme={VictoryTheme.material} height={250}>
          <VictoryAxis dependentAxis style={{ tickLabels: { fill: '#9999AA' } }} />
          <VictoryAxis style={{ tickLabels: { fill: '#9999AA' } }} />
          <VictoryLine
            style={{
              data: { stroke: "#00FF88", strokeWidth: 3 },
            }}
            data={chartData}
            interpolation="natural"
          />
        </VictoryChart>
      </View>

      <Text className="text-textSecondary text-lg mb-4">Earnings Log</Text>
      <FlatList
        data={history}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <View className="bg-surface border border-border p-4 rounded-xl mb-3 flex-row justify-between">
            <View>
              <Text className="text-textSecondary text-sm">{new Date(item.timestamp).toLocaleTimeString()}</Text>
              <Text className="text-textTertiary text-xs">{item.requests} requests</Text>
            </View>
            <Text className="text-primary font-bold">+{(item.lamports / 1e9).toFixed(5)} SOL</Text>
          </View>
        )}
        ListEmptyComponent={<Text className="text-textTertiary">No earnings yet. Keep your node active.</Text>}
      />
      </View>
    </SafeAreaView>
  );
}
