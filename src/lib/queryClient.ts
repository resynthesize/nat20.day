import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default: 5 minute stale time for Supabase data
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Disable automatic refetching - we use real-time subscriptions
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      // Retry failed queries up to 2 times
      retry: 2,
    },
    mutations: {
      retry: 1,
    },
  },
})
