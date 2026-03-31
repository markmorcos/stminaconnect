import { useQuery } from '@tanstack/react-query';
import { listServants, getServant } from '../api/queries/servants';

export const SERVANTS_QUERY_KEY = ['servants'] as const;

export function useServants() {
  return useQuery({
    queryKey: SERVANTS_QUERY_KEY,
    queryFn: listServants,
    staleTime: 5 * 60 * 1000, // 5 min — servant list rarely changes
  });
}

export function useServant(id: string) {
  return useQuery({
    queryKey: [...SERVANTS_QUERY_KEY, id],
    queryFn: () => getServant(id),
    enabled: !!id,
  });
}
