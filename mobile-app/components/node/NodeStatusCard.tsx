import { View, Text } from 'react-native';
import { NodeToggle } from './NodeToggle';
import { PulseIndicator } from './PulseIndicator';

interface Props {
  active: boolean;
  onToggle: () => void;
  isOnline: boolean;
  uptimeSeconds: number;
}

export function NodeStatusCard({ active, onToggle, isOnline, uptimeSeconds }: Props) {
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);

  return (
    <View className="bg-surface border border-border p-6 rounded-2xl items-center mb-6 w-full">
      <View className="flex-row items-center mb-6">
        <PulseIndicator active={active && isOnline} />
        <Text className="text-white ml-2 text-lg font-bold">
          {active ? (isOnline ? 'Earning' : 'Connecting...') : 'Offline'}
        </Text>
      </View>
      <NodeToggle active={active} onToggle={onToggle} />
      {active && isOnline && (
        <Text className="text-textSecondary mt-4 text-sm font-mono">
          Uptime: {hours}h {minutes}m
        </Text>
      )}
    </View>
  );
}
