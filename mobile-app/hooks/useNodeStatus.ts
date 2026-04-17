import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../services/solnetApi';
import { useNodeStore } from '../stores/nodeStore';
import { useEarningsStore } from '../stores/earningsStore';
import { useEffect } from 'react';

export function useNodeStatus() {
  const { isActive, updateFromHealth, setOffline } = useNodeStore();
  const updateEarnings = useEarningsStore((s) => s.updateEarnings);

  const query = useQuery({
    queryKey: ['nodeHealth'],
    queryFn: async () => {
      const data = await getHealth();
      if (!data) throw new Error('Health check failed');
      return data;
    },
    refetchInterval: isActive ? 10000 : false,
    enabled: isActive,
    retry: false
  });

  useEffect(() => {
    if (query.data) {
      updateFromHealth(query.data);
      updateEarnings(query.data);
    } else if (query.isError) {
      setOffline();
    }
  }, [query.data, query.isError]);

  return query;
}
