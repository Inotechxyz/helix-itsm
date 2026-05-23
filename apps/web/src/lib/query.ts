import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds - faster cache invalidation for org switching
      gcTime: 1000 * 60, // 60 seconds - garbage collect stale queries faster
      retry: 1,
      refetchOnWindowFocus: true, // Refetch when user returns to tab
    },
  },
});
