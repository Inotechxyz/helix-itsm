/**
 * Cached Query Hooks using TanStack Query
 *
 * These hooks provide caching through React Query's built-in mechanisms.
 * For server-side caching, implement Redis caching in the API layer.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Cache TTL configurations (in milliseconds)
export const CACHE_TTL = {
  short: 30 * 1000, // 30 seconds
  medium: 5 * 60 * 1000, // 5 minutes
  long: 15 * 60 * 1000, // 15 minutes
  veryLong: 60 * 60 * 1000, // 1 hour
};

/**
 * Create a cached query hook using React Query's caching
 */
export function createCachedQuery<T>(
  queryKey: string,
  fetchFn: () => Promise<T>,
  ttl: number = CACHE_TTL.medium
) {
  return function useCachedQuery(params?: any) {
    return useQuery<T>({
      queryKey: [queryKey, params],
      queryFn: fetchFn,
      staleTime: ttl,
      gcTime: ttl * 2,
      refetchOnWindowFocus: false,
      retry: 1,
    });
  };
}

/**
 * Hook for queries that should always fetch fresh data
 */
export function useFreshQuery<T>(
  queryKey: string[],
  fetchFn: () => Promise<T>,
  options?: any
) {
  return useQuery<T>({
    queryKey,
    queryFn: fetchFn,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    ...options,
  });
}

/**
 * Hook for mutations that invalidate related queries
 */
export function useCachedMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    invalidateQueries?: string[];
  }
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn,
    onSuccess: async () => {
      if (options?.invalidateQueries) {
        for (const key of options.invalidateQueries) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
    },
  });
}

/**
 * Clear all query caches
 */
export async function clearAllCaches(queryClient: any): Promise<void> {
  await queryClient.clear();
}
