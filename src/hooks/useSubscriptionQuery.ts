import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { fetchSubscription, type SubscriptionInfo } from '../lib/queries'

interface UseSubscriptionQueryOptions {
  enabled?: boolean
}

export function useSubscriptionQuery(
  partyId: string | undefined,
  options: UseSubscriptionQueryOptions = {}
) {
  return useQuery({
    queryKey: queryKeys.subscription(partyId ?? ''),
    queryFn: async () => {
      if (!partyId) return null

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      return fetchSubscription(partyId, session.access_token)
    },
    enabled: !!partyId && (options.enabled ?? true),
    // AGGRESSIVE caching for Vercel API - free tier limits
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}

export function useCancelSubscription(partyId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!partyId) throw new Error('No party selected')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/v1/billing/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ party_id: partyId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to cancel subscription')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription(partyId ?? '') })
    },
  })
}

export function useReactivateSubscription(partyId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!partyId) throw new Error('No party selected')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/v1/billing/reactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ party_id: partyId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to reactivate subscription')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription(partyId ?? '') })
    },
  })
}

// Re-export type for convenience
export type { SubscriptionInfo }
