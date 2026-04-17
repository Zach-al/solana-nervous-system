import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet } from '../../hooks/useWallet';
import { CONFIG } from '../../constants/theme';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const { address, disconnect } = useWallet();
  const router = useRouter();

  const handleDisconnect = async () => {
    await disconnect();
    await AsyncStorage.removeItem('onboarding_complete');
    router.replace('/(onboarding)/welcome');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6 pt-12">
      <Text className="text-white text-3xl font-bold mb-8">Settings</Text>

      <Text className="text-textSecondary mb-2 font-bold uppercase text-xs tracking-wider">Wallet</Text>
      <View className="bg-surface border border-border p-4 rounded-2xl mb-8">
        <Text className="text-textTertiary text-xs mb-1">CONNECTED ADDRESS</Text>
        <Text className="text-white font-mono text-sm mb-4">{address || 'None'}</Text>
        <TouchableOpacity onPress={handleDisconnect} className="bg-danger/20 py-3 rounded-lg border border-danger">
          <Text className="text-danger font-bold text-center">Disconnect Wallet</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-textSecondary mb-2 font-bold uppercase text-xs tracking-wider">Node Preferences</Text>
      <View className="bg-surface border border-border p-4 rounded-2xl mb-8">
        <View className="flex-row justify-between mb-4">
          <Text className="text-white">Run while charging only</Text>
          <Text className="text-primary font-bold">ON</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-white">Run on mobile data</Text>
          <Text className="text-primary font-bold">ON</Text>
        </View>
      </View>

      <Text className="text-textSecondary mb-2 font-bold uppercase text-xs tracking-wider">About</Text>
      <View className="bg-surface border border-border p-4 rounded-2xl mb-12">
        <View className="flex-row justify-between mb-4">
          <Text className="text-white">Version</Text>
          <Text className="text-textSecondary">{CONFIG.APP_VERSION}</Text>
        </View>
        <TouchableOpacity>
          <Text className="text-primary">Privacy Policy</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}
