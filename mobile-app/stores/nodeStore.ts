import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { HealthResponse } from '../types';
import { MemoryStorage } from '../services/Storage';

interface NodeState {
  isActive: boolean;
  nodeId: string | null;
  requestsServed: number;
  uptimeSeconds: number;
  lastPing: string | null;
  isOnline: boolean;
  setActive: (active: boolean) => void;
  setNodeId: (id: string) => void;
  updateFromHealth: (data: HealthResponse) => void;
  updateFromLocalStats: (stats: { requests_served: number; uptime_seconds: number }) => void;
  setOffline: () => void;
}

export const useNodeStore = create<NodeState>()(
  persist(
    (set, get) => ({
      isActive: false,
      nodeId: null,
      requestsServed: 0,
      uptimeSeconds: 0,
      lastPing: null,
      isOnline: false,
      setActive: (active) => set({ isActive: active }),
      setNodeId: (id) => set({ nodeId: id }),
      updateFromHealth: (data) => set({
        requestsServed: data.requests_served || get().requestsServed,
        uptimeSeconds: data.uptime_seconds || get().uptimeSeconds,
        lastPing: new Date().toISOString(),
        isOnline: true,
      }),
      updateFromLocalStats: (stats) => set({
        requestsServed: stats.requests_served,
        uptimeSeconds: stats.uptime_seconds,
        isOnline: true,
      }),
      setOffline: () => set({ isOnline: false }),
    }),
    {
      name: 'solnet-node-storage',
      // Using MemoryStorage to bypass the "AsyncStorage is null" crash
      storage: createJSONStorage(() => MemoryStorage),
      partialize: (state) => ({ isActive: state.isActive, nodeId: state.nodeId }),
    }
  )
);
