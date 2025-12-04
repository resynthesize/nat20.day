import { QueryClient } from '@tanstack/react-query'
import { CACHE } from './constants'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: CACHE.STALE_TIME_DEFAULT,
      gcTime: CACHE.GC_TIME_DEFAULT,
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
