import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet } from '../../hooks/useWallet';
import { CONFIG } from '../../constants/theme';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState, useEffect } from 'react';
import { DaemonBridge } from '../../services/DaemonBridge';
import { TextInput } from 'react-native';

export default function SettingsScreen() {
  const { address, disconnect } = useWallet();
  const router = useRouter();
  const [peerAddress, setPeerAddress] = useState('');
  const [mdnsEnabled, setMdnsEnabled] = useState(false);
  const [peerCount, setPeerCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (DaemonBridge.isAvailable) {
        const count = await DaemonBridge.getPeerCount();
        setPeerCount(count);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleDial = async () => {
    if (!peerAddress) return;
    const success = await DaemonBridge.dialPeer(peerAddress);
    if (success) {
      setPeerAddress('');
    }
  };

  const toggleMdns = async () => {
    const newState = !mdnsEnabled;
    setMdnsEnabled(newState);
    await DaemonBridge.initP2PNode(newState);
  };

  const handleDisconnect = async () => {
    await disconnect();
    await SecureStore.deleteItemAsync('onboarding_complete');
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

      <Text className="text-textSecondary mb-2 font-bold uppercase text-xs tracking-wider">Network Discovery</Text>
      <View className="bg-surface border border-border p-4 rounded-2xl mb-8">
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-white font-bold">Local discovery (mDNS)</Text>
            <Text className="text-textTertiary text-[10px] mt-1">ENABLE ONLY FOR SAME-WIFI CONNECTIVITY</Text>
          </View>
          <TouchableOpacity 
            onPress={toggleMdns}
            className={`px-4 py-1.5 rounded-full ${mdnsEnabled ? 'bg-primary' : 'bg-surfaceDark border border-border'}`}
          >
            <Text className={`${mdnsEnabled ? 'text-background' : 'text-textSecondary'} font-bold text-xs`}>
              {mdnsEnabled ? 'ENABLED' : 'DISABLED'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-white">Connected Peers</Text>
          <View className="bg-primary/20 px-3 py-1 rounded-full border border-primary/30">
            <Text className="text-primary font-bold">{peerCount}</Text>
          </View>
        </View>

        <Text className="text-textTertiary text-[10px] mb-2 uppercase font-bold tracking-tighter">Manual Peer Connect</Text>
        <TextInput
          placeholder="/ip4/1.2.3.4/tcp/9001/p2p/..."
          placeholderTextColor="#666"
          value={peerAddress}
          onChangeText={setPeerAddress}
          className="bg-background border border-border p-3 rounded-xl text-white font-mono text-[10px] mb-3"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity 
          onPress={handleDial}
          disabled={!peerAddress}
          className={`py-3 rounded-xl border ${peerAddress ? 'bg-primary/20 border-primary' : 'bg-surfaceDark border-border opacity-50'}`}
        >
          <Text className={`${peerAddress ? 'text-primary' : 'text-textTertiary'} font-bold text-center text-xs`}>CONNECT TO PEER</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-textSecondary mb-2 font-bold uppercase text-xs tracking-wider">About</Text>
      <View className="bg-surface border border-border p-4 rounded-2xl mb-12">
        <View className="flex-row justify-between mb-4">
          <Text className="text-white">Version</Text>
          <Text className="text-textSecondary">{CONFIG.APP_VERSION}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings/privacy')}>
          <Text className="text-primary font-bold">Privacy Protocol</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}
