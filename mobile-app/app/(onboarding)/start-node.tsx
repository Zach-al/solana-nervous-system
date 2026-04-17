import { SafeAreaView, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useWallet } from '../../hooks/useWallet';
import { registerNode } from '../../services/solnetApi';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNodeStore } from '../../stores/nodeStore';
import * as Crypto from 'expo-crypto';

export default function StartNodeScreen() {
  const router = useRouter();
  const { address } = useWallet();
  const { setNodeId } = useNodeStore();

  const activateNode = async () => {
    if (!address) return;
    try {
      const deviceId = Crypto.randomUUID();
      const res = await registerNode(address, deviceId);
      
      if (res.success) {
        await SecureStore.setItemAsync('solnet_node_id', res.node_id);
        setNodeId(res.node_id);
        await AsyncStorage.setItem('onboarding_complete', 'true');
        router.replace('/(tabs)');
      }
    } catch (e) {
      console.error(e);
      await AsyncStorage.setItem('onboarding_complete', 'true');
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background justify-center px-6">
      <Text className="text-white text-3xl font-bold mb-6">You're almost earning</Text>
      <View className="bg-surface border border-border rounded-xl p-4 mb-8">
        <Text className="text-textSecondary mb-2">Connected Wallet:</Text>
        <Text className="text-primary font-mono">{address}</Text>
      </View>
      <Text className="text-textSecondary mb-8 text-center">Estimated earnings: $12–50/month</Text>
      <TouchableOpacity 
        className="w-full bg-primary rounded-xl py-4"
        onPress={activateNode}
      >
        <Text className="text-background font-bold text-lg text-center">Start My Node</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
