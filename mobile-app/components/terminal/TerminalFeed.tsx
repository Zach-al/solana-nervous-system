import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { Colors, Radius, Spacing, Typography } from '../../constants/antigravity';
import GlassCard from '../ui/GlassCard';

import { DaemonBridge } from '../../services/DaemonBridge';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'peer' | 'settle' | 'native';
  message: string;
}

interface TerminalFeedProps {
  isActive: boolean;
  nodeId: string | null;
}

export default function TerminalFeed({ isActive, nodeId }: TerminalFeedProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cursorVisible, setCursorVisible] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible(v => !v);
    }, 600);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    if (isActive) {
      // Wire up real-time logs from the Rust engine
      const sub = DaemonBridge.onLogLine((line) => {
        const newLog: LogEntry = {
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: new Date().toLocaleTimeString('en-GB'),
          type: line.includes('WARN') ? 'warn' : 
                 line.includes('ERR') ? 'warn' : 
                 line.includes('SUCCESS') ? 'success' : 'native',
          message: line,
        };
        setLogs(prev => [newLog, ...prev].slice(0, 30));
      });

      return () => sub?.remove();
    } else {
      setLogs(prev => [
        {
          id: `shutdown-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-GB'),
          type: 'warn',
          message: 'Node deactivated — earnings paused'
        } as LogEntry,
        ...prev
      ].slice(0, 30));
    }
  }, [isActive]);

  const getColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return Colors.green;
      case 'warn':    return Colors.warning;
      case 'peer':    return Colors.purple;
      case 'settle':  return Colors.cyan;
      case 'native':  return Colors.textPrimary;
      default:        return Colors.textSecondary;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>TERMINAL</Text>
        <Text style={[styles.cursor, { opacity: cursorVisible ? 1 : 0 }]}>█</Text>
      </View>
      
      <ScrollView 
        ref={scrollRef}
        style={styles.list}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      >
        {logs.map((item, index) => (
          <Animated.View 
            key={item.id}
            entering={FadeIn.duration(300).delay(50)}
            layout={Layout.springify()}
          >
            <View style={[styles.entry, { opacity: index === 0 ? 1 : Math.max(0.4, 1 - (index * 0.15)) }]}>
              <Text style={styles.entryText} numberOfLines={2}>
                <Text style={styles.monoDim}>{`> `}</Text>
                <Text style={{ color: getColor(item.type) }}>{item.message}</Text>
              </Text>
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 160,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.md,
    padding: 14,
    overflow: 'hidden', 
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
