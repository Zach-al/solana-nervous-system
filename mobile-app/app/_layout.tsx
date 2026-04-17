import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerBackgroundFetchAsync } from '../services/backgroundTask';
import '../global.css';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

const queryClient = new QueryClient();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isReady) {
      const checkOnboarding = async () => {
        try {
          const onboarded = await AsyncStorage.getItem('onboarding_complete');
          const isFinished = onboarded === 'true';
          const inOnboardingGroup = segments[0] === '(onboarding)';
          
          if (isFinished && inOnboardingGroup) {
            registerBackgroundFetchAsync().catch(console.error);
            router.replace('/(tabs)');
          } else if (!isFinished && !inOnboardingGroup) {
            router.replace('/(onboarding)/welcome');
          } else if (isFinished) {
            registerBackgroundFetchAsync().catch(console.error);
          }
        } catch (e) {
          console.error('Failed to check onboarding state', e);
        } finally {
          setIsReady(true);
        }
      };
      checkOnboarding();
    }
  }, [segments, isReady]);

  if (!isReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
