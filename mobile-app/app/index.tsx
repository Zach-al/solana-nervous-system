import { Redirect } from 'expo-router';

export default function RootIndex() {
  // Redirect to welcome screen by default. 
  // app/_layout.tsx will handle hijacking this if the user is already onboarded.
  return <Redirect href="/(onboarding)/welcome" />;
}
