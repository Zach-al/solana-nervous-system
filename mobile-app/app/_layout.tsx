import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerBackgroundFetchAsync } from '../services/backgroundTask';
import '../global.css';

const queryClient = new QueryClient();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      const onboarded = await AsyncStorage.getItem('onboarding_complete');
      const inOnboardingGroup = segments[0] === '(onboarding)';
      
      if (onboarded === 'true' && inOnboardingGroup) {
        registerBackgroundFetchAsync().catch(console.error);
        router.replace('/(tabs)');
      } else if (onboarded !== 'true' && !inOnboardingGroup) {
        router.replace('/(onboarding)/welcome');
      } else if (onboarded === 'true') {
        registerBackgroundFetchAsync().catch(console.error);
      }
      setIsReady(true);
    };
    checkOnboarding();
  }, [segments]);

  if (!isReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
