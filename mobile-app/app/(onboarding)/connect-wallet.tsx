import { SafeAreaView, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useWallet } from '../../hooks/useWallet';

export default function ConnectWalletScreen() {
  const router = useRouter();
  const { connect, generateLocal } = useWallet();

  const handleConnect = async () => {
    try {
      await connect();
      router.push('/start-node');
    } catch (e: any) {
      console.warn('Wallet connection bypassed:', e.message);
      // Fallback cleanly without unhandled rejections
      await handleGenerate();
    }
  };

  const handleGenerate = async () => {
    try {
      await generateLocal();
      router.push('/start-node');
    } catch (e) {
      console.warn('Local generation failed', e);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background justify-center px-6">
      <Text className="text-white text-3xl font-bold mb-2">Connect Your Wallet</Text>
      <Text className="text-textSecondary text-lg mb-10">Your earnings go directly to your wallet. We never touch your keys.</Text>

      <TouchableOpacity 
        className="w-full bg-surfaceHover border border-border rounded-xl py-4 mb-4"
        onPress={handleConnect}
      >
        <Text className="text-white font-bold text-center">Connect with Mobile Wallet</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="w-full bg-surfaceHover border border-border rounded-xl py-4"
        onPress={handleGenerate}
      >
        <Text className="text-primary font-bold text-center">Create a wallet for me</Text>
      </TouchableOpacity>
      
      <Text className="text-textTertiary text-center mt-8">Your keys, your crypto. SOLNET only sees your public address.</Text>
    </SafeAreaView>
  );
}
