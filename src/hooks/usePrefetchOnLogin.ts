import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { useParty } from './useParty'
import { queryKeys } from '../lib/queryKeys'
import { fetchPartyMembers, fetchPartyAdmins } from '../lib/queries'

/**
 * Prefetches data on login to improve navigation speed.
 *
 * Prefetches (Supabase - no API limit concerns):
 * - Party members for current party
 * - Party admins for current party
 *
 * NOT prefetched (Vercel API - free tier limits):
 * - Billing/subscription data
 * - API tokens
 */
export function usePrefetchOnLogin() {
  const { isAuthenticated } = useAuth()
  const { currentParty } = useParty()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isAuthenticated || !currentParty) return

    // Prefetch party members and admins in parallel (Supabase - no limit concerns)
    // These will be used when navigating to Admin panel
    queryClient.prefetchQuery({
      queryKey: queryKeys.partyMembers(currentParty.id),
      queryFn: () => fetchPartyMembers(currentParty.id),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })

    queryClient.prefetchQuery({
      queryKey: queryKeys.partyAdmins(currentParty.id),
      queryFn: () => fetchPartyAdmins(currentParty.id),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })
  }, [isAuthenticated, currentParty, queryClient])
}
