import { useEarningsStore } from '../stores/earningsStore';

export function useEarnings() {
  const store = useEarningsStore();
  return {
    lifetimeLamports: store.lifetimeLamports,
    todayLamports: store.todayLamports,
    history: store.history,
  };
}
