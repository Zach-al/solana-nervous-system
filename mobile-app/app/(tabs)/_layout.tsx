import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarStyle: { backgroundColor: '#13131A', borderTopColor: '#2A2A3A' },
      tabBarActiveTintColor: '#00FF88',
      tabBarInactiveTintColor: '#55556A'
    }}>
      <Tabs.Screen 
        name="index" 
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }} 
      />
      <Tabs.Screen 
        name="earnings" 
        options={{ title: 'Earnings', tabBarIcon: ({ color }) => <Ionicons name="wallet" size={24} color={color} /> }} 
      />
      <Tabs.Screen 
        name="network" 
        options={{ title: 'Network', tabBarIcon: ({ color }) => <Ionicons name="globe" size={24} color={color} /> }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{ title: 'Settings', tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} /> }} 
      />
    </Tabs>
  );
}
