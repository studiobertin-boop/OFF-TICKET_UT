import { useQuery } from '@tanstack/react-query';
import { activityApi } from '../services/api/activity';

export function useRecentActivity(requestTypeName?: string, limit = 20) {
  return useQuery({
    queryKey: ['activity', 'recent', requestTypeName, limit],
    queryFn: () => activityApi.getRecentActivity(requestTypeName, limit),
    staleTime: 10000, // 10 secondi
    refetchInterval: 30000, // Ricarica automaticamente ogni 30 secondi
  });
}
