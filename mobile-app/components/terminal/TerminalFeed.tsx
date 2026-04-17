import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, FlatList } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { Colors, Radius, Spacing, Typography } from '../../constants/antigravity';
import GlassCard from '../ui/GlassCard';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'peer' | 'settle';
  message: string;
}

interface TerminalFeedProps {
  isActive: boolean;
  nodeId: string | null;
}

const LOG_MESSAGES = [
  { type: 'peer',    message: 'P2P handshake complete — Singapore relay' },
  { type: 'info',    message: 'Kademlia DHT: routing table updated' },
  { type: 'success', message: 'Batch settled: +0.00010 SOL' },
  { type: 'info',    message: 'Cache hit: getSlot() → L1 (0.3ms)' },
  { type: 'peer',    message: 'New peer: /ip4/139.x.x.x/tcp/9001' },
  { type: 'info',    message: 'RPC forwarded: getBalance() → upstream' },
  { type: 'success', message: 'Request served: +100 lamports' },
  { type: 'warn',    message: 'Upstream latency spike: 340ms — rerouting' },
  { type: 'info',    message: 'libp2p Kademlia: 1 peer in routing table' },
  { type: 'settle',  message: 'ZK receipt: batch #47 queued for settlement' },
  { type: 'info',    message: 'Health check: node_id confirmed live' },
];

export default function TerminalFeed({ isActive, nodeId }: TerminalFeedProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cursorVisible, setCursorVisible] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible(v => !v);
    }, 600);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    if (isActive) {
      const addRandomLog = () => {
        const template = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
        const newLog: LogEntry = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString('en-GB'),
          ...template as any
        };
        
        setLogs(prev => [newLog, ...prev].slice(0, 20));
        
        const nextDelay = 8000 + Math.random() * 7000;
        // @ts-ignore - Type mismatch between NodeJS.Timeout and number in RN/Web
        timerRef.current = setTimeout(addRandomLog, nextDelay);
      };

      // @ts-ignore
      timerRef.current = setTimeout(addRandomLog, 2000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setLogs(prev => [
        {
          id: `shutdown-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-GB'),
          type: 'warn',
          message: 'Node deactivated — earnings paused'
        } as LogEntry,
        ...prev
      ].slice(0, 20));
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive]);

  const getColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return Colors.green;
      case 'warn':    return Colors.warning;
      case 'peer':    return Colors.purple;
      case 'settle':  return Colors.cyan;
      default:        return Colors.textSecondary;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>TERMINAL</Text>
        <Text style={[styles.cursor, { opacity: cursorVisible ? 1 : 0 }]}>█</Text>
      </View>
      
      <View style={styles.list}>
        {logs.map((item, index) => (
          <Animated.View 
            key={item.id}
            entering={FadeIn.duration(300).delay(50)}
            layout={Layout.springify()}
            style={[styles.entry, { opacity: 1 - (index * 0.05) }]}
          >
            <Text style={styles.entryText}>
              <Text style={styles.monoDim}>{`> [${item.timestamp}] `}</Text>
              <Text style={{ color: getColor(item.type) }}>{item.message}</Text>
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 180,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.md,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  headerText: {
    ...Typography.monoHeader,
    fontSize: 9,
    letterSpacing: 3,
  },
  cursor: {
    ...Typography.mono,
    color: Colors.cyan,
    fontSize: 9,
  },
  list: {
    flex: 1,
  },
  entry: {
    height: 22,
    justifyContent: 'center',
  },
  entryText: {
    ...Typography.mono,
    fontSize: 11,
  },
  monoDim: {
    color: Colors.textTertiary,
  }
});
