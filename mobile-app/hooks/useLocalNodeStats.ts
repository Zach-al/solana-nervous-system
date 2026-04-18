import { useEffect, useRef } from 'react';
import { DaemonBridge } from '../services/DaemonBridge';
import { useNodeStore } from '../stores/nodeStore';

/**
 * useLocalNodeStats
 * 
 * High-frequency polling hook for the local native bridge.
 * Syncs real-time Rust engine stats (uptime, requests) to the global store.
 */
export function useLocalNodeStats() {
  const { isActive, updateFromLocalStats } = useNodeStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && DaemonBridge.isAvailable) {
      const poll = async () => {
        try {
          const stats = await DaemonBridge.getStats();
          if (!stats.isStub) {
            updateFromLocalStats({
              requests_served: stats.requests_served,
              uptime_seconds: stats.uptime_seconds,
            });
          }
        } catch (err) {
          console.warn('[useLocalNodeStats] Bridge polling failed:', err);
        }
        
        // Poll every 1s for "Live" dashboard feel
        timerRef.current = setTimeout(poll, 1000);
      };

      poll();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive]);

  return null;
}
