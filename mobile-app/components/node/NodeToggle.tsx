import { TouchableOpacity, Text } from 'react-native';

export function NodeToggle({ active, onToggle }: { active: boolean, onToggle: () => void }) {
  return (
    <TouchableOpacity 
      className={`py-3 px-8 rounded-full border ${active ? 'bg-primary/20 border-primary' : 'bg-surface border-border'}`}
      onPress={onToggle}
    >
      <Text className={`font-bold text-center ${active ? 'text-primary' : 'text-textSecondary'}`}>
        {active ? 'NODE ACTIVE' : 'NODE PAUSED'}
      </Text>
    </TouchableOpacity>
  );
}
