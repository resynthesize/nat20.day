import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { useParty } from './useParty'
import { queryKeys } from '../lib/queryKeys'
import { fetchPartyMembers, fetchPartyAdmins } from '../lib/queries'
import { fetchAvailabilityData } from './useAvailability'

/**
 * Prefetches data on login to improve navigation speed.
 *
 * Prefetches (Supabase - no API limit concerns):
 * - Availability data for ALL parties (enables instant party switching)
 * - Party members for current party (for admin panel)
 * - Party admins for current party (for admin panel)
 *
 * NOT prefetched (Vercel API - free tier limits):
 * - Billing/subscription data
 * - API tokens
 */
export function usePrefetchOnLogin() {
  const { isAuthenticated } = useAuth()
  const { parties, currentParty } = useParty()
  const queryClient = useQueryClient()

  // Prefetch availability for ALL parties (enables instant party switching)
  useEffect(() => {
    if (!isAuthenticated || parties.length === 0) return

    // Prefetch each party's availability data in parallel
    parties.forEach((party) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.availability(party.id),
        queryFn: () => fetchAvailabilityData(party.id, party.days_of_week),
        staleTime: Infinity, // Never stale - real-time handles updates
      })
    })
  }, [isAuthenticated, parties, queryClient])

  // Prefetch admin panel data for current party
  useEffect(() => {
    if (!isAuthenticated || !currentParty) return

    // Prefetch party members and admins in parallel (Supabase - no limit concerns)
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
