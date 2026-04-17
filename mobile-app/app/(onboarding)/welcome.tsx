import { SafeAreaView, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background justify-center items-center px-6">
      <View className="mb-12 items-center">
        <View className="w-24 h-24 rounded-full bg-primary/20 items-center justify-center">
          <View className="w-12 h-12 rounded-full bg-primary" />
        </View>
        <Text className="text-white text-3xl font-bold mt-8 text-center">Your phone. Your node. Your SOL.</Text>
        <Text className="text-textSecondary text-lg text-center mt-4">Earn passive income by routing Solana traffic</Text>
      </View>
      <TouchableOpacity 
        className="w-full bg-primary rounded-xl py-4"
        onPress={() => router.push('/connect-wallet')}
      >
        <Text className="text-background font-bold text-lg text-center">Get Started</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
