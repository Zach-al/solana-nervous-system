import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MemoryStorage } from '../services/Storage';
import type { HealthResponse, EarningEntry } from '../types';

interface EarningsState {
  lifetimeLamports: number;
  pendingLamports: number;
  todayLamports: number;
  history: EarningEntry[];
  lastRequestCount: number;
  lastUpdatedDate: string | null;
  updateEarnings: (health: HealthResponse) => void;
  appendHistory: (entry: EarningEntry) => void;
  resetTodayIfNeeded: () => void;
}

export const useEarningsStore = create<EarningsState>()(
  persist(
    (set, get) => ({
      lifetimeLamports: 0,
      pendingLamports: 0,
      todayLamports: 0,
      history: [],
      lastRequestCount: 0,
      lastUpdatedDate: null,
      
      updateEarnings: (health) => {
        get().resetTodayIfNeeded();
        if (health.earnings_lamports !== undefined && health.requests_served !== undefined) {
           const currentLifeTime = get().lifetimeLamports;
           const deltaLamports = Math.max(0, health.earnings_lamports - currentLifeTime);
           const currentRequests = get().lastRequestCount;
           const deltaRequests = Math.max(0, health.requests_served - currentRequests);
           
           if (deltaLamports > 0 || deltaRequests > 0) {
             const now = new Date().toISOString();
             get().appendHistory({ timestamp: now, lamports: deltaLamports, requests: deltaRequests });
             set((state) => ({ 
               lifetimeLamports: health.earnings_lamports,
               todayLamports: state.todayLamports + deltaLamports,
               lastRequestCount: health.requests_served
             }));
           }
        }
      },
      
      appendHistory: (entry) => set((state) => ({ history: [entry, ...state.history] })),
      
      resetTodayIfNeeded: () => {
        const todayStr = new Date().toDateString();
        const { lastUpdatedDate } = get();
        if (lastUpdatedDate !== todayStr) {
           set({ todayLamports: 0, lastUpdatedDate: todayStr });
        }
      }
    }),
    {
      name: 'solnet-earnings-storage',
      storage: createJSONStorage(() => MemoryStorage),
    }
  )
);
