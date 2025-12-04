import { useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import {
  parsePartyMembers,
  parseAvailabilityWithMembers,
  type PartyMember,
  type AvailabilityWithMember,
} from '../lib/schemas'
import { generateDates } from '../lib/dates'

interface AvailabilityData {
  dates: string[]
  partyMembers: PartyMember[]
  availability: AvailabilityWithMember[]
}

interface UseAvailabilityOptions {
  partyId: string | null
  daysOfWeek?: number[]
}

async function fetchAvailabilityData(
  partyId: string,
  daysOfWeek?: number[]
): Promise<AvailabilityData> {
  const dates = generateDates(8, daysOfWeek)
  const fromDate = dates[0]
  const toDate = dates[dates.length - 1]

  const [membersResult, availabilityResult] = await Promise.all([
    supabase
      .from('party_members')
      .select(`
        id,
        party_id,
        name,
        email,
        profile_id,
        created_at,
        profiles (
          display_name,
          avatar_url
        )
      `)
      .eq('party_id', partyId)
      .order('name'),
    supabase
      .from('availability')
      .select(`
        id,
        party_member_id,
        date,
        available,
        updated_at,
        party_members!inner (
          name,
          party_id
        )
      `)
      .eq('party_members.party_id', partyId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date'),
  ])

  if (membersResult.error) throw membersResult.error
  if (availabilityResult.error) throw availabilityResult.error

  // Supabase returns joined data as arrays - normalize before parsing
  const normalizedMembers = (membersResult.data ?? []).map((item) => ({
    ...item,
    profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
  }))

  const normalizedAvailability = (availabilityResult.data ?? []).map((item) => ({
    ...item,
    party_members: Array.isArray(item.party_members) ? item.party_members[0] : item.party_members,
  }))

  const parsedMembers = parsePartyMembers(normalizedMembers)

  // Persist member count for skeleton loading state
  try {
    localStorage.setItem('nat20-last-member-count', String(parsedMembers.length))
  } catch {
    // localStorage may not be available
  }

  return {
    dates,
    partyMembers: parsedMembers,
    availability: parseAvailabilityWithMembers(normalizedAvailability),
  }
}

export function useAvailability({ partyId, daysOfWeek }: UseAvailabilityOptions) {
  const queryClient = useQueryClient()

  // Skip realtime refreshes during local mutations to prevent flash
  const mutatingRef = useRef(false)

  // TanStack Query for initial fetch + caching
  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.availability(partyId ?? ''),
    queryFn: () => fetchAvailabilityData(partyId!, daysOfWeek),
    enabled: !!partyId,
    // Never automatically refetch - real-time handles updates
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })

  // Default values when no data
  const dates = data?.dates ?? []
  const partyMembers = data?.partyMembers ?? []
  const availability = data?.availability ?? []
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch data') : null

  // Helper to update cache
  const updateCache = useCallback(
    (updater: (old: AvailabilityData | undefined) => AvailabilityData | undefined) => {
      queryClient.setQueryData<AvailabilityData>(
        queryKeys.availability(partyId ?? ''),
        updater
      )
    },
    [queryClient, partyId]
  )

  const setAvailability = useCallback(
    async (memberId: string, date: string, available: boolean) => {
      mutatingRef.current = true

      // Optimistic update
      updateCache((old) => {
        if (!old) return old

        const existing = old.availability.find(
          (a) => a.party_member_id === memberId && a.date === date
        )

        if (existing) {
          return {
            ...old,
            availability: old.availability.map((a) =>
              a.party_member_id === memberId && a.date === date ? { ...a, available } : a
            ),
          }
        }

        const member = old.partyMembers.find((m) => m.id === memberId)
        if (!member) return old

        return {
          ...old,
          availability: [
            ...old.availability,
            {
              id: `temp-${memberId}-${date}`,
              party_member_id: memberId,
              date,
              available,
              updated_at: new Date().toISOString(),
              party_members: { name: member.name },
            },
          ],
        }
      })

      const { error } = await supabase
        .from('availability')
        .upsert(
          { party_member_id: memberId, date, available },
          { onConflict: 'party_member_id,date' }
        )

      // Small delay to let realtime event pass before allowing refreshes
      setTimeout(() => {
        mutatingRef.current = false
      }, 500)

      if (error) {
        console.error('Error setting availability:', error)
        // Refetch on error to restore correct state
        queryClient.invalidateQueries({ queryKey: queryKeys.availability(partyId ?? '') })
      }
    },
    [updateCache, queryClient, partyId]
  )

  const clearAvailability = useCallback(
    async (memberId: string, date: string) => {
      mutatingRef.current = true

      // Optimistic update
      updateCache((old) => {
        if (!old) return old
        return {
          ...old,
          availability: old.availability.filter(
            (a) => !(a.party_member_id === memberId && a.date === date)
          ),
        }
      })

      const { error } = await supabase
        .from('availability')
        .delete()
        .eq('party_member_id', memberId)
        .eq('date', date)

      // Small delay to let realtime event pass before allowing refreshes
      setTimeout(() => {
        mutatingRef.current = false
      }, 500)

      if (error) {
        console.error('Error clearing availability:', error)
        mutatingRef.current = false
        // Refetch on error to restore correct state
        queryClient.invalidateQueries({ queryKey: queryKeys.availability(partyId ?? '') })
      }
    },
    [updateCache, queryClient, partyId]
  )

  // Subscribe to realtime updates - update TQ cache directly
  useEffect(() => {
    if (!partyId) return

    const channel = supabase
      .channel(`availability-changes-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'availability' },
        (payload) => {
          // Skip refresh during local mutations to prevent flash
          if (mutatingRef.current) return

          const { eventType, new: newRecord, old: oldRecord } = payload

          updateCache((old) => {
            if (!old) return old

            // Only process if this availability belongs to a member in our party
            const memberId = (newRecord as { party_member_id?: string })?.party_member_id ||
                             (oldRecord as { party_member_id?: string })?.party_member_id
            const memberInParty = old.partyMembers.some((m) => m.id === memberId)
            if (!memberInParty) return old

            switch (eventType) {
              case 'INSERT': {
                const record = newRecord as {
                  id: string
                  party_member_id: string
                  date: string
                  available: boolean
                  updated_at: string
                }
                // Check if date is within our displayed range
                if (!old.dates.includes(record.date)) return old
                // Avoid duplicates (might already exist from optimistic update)
                const exists = old.availability.some(
                  (a) => a.party_member_id === record.party_member_id && a.date === record.date
                )
                if (exists) {
                  // Update existing record
                  return {
                    ...old,
                    availability: old.availability.map((a) =>
                      a.party_member_id === record.party_member_id && a.date === record.date
                        ? { ...a, id: record.id, available: record.available, updated_at: record.updated_at }
                        : a
                    ),
                  }
                }
                // Add new record
                const member = old.partyMembers.find((m) => m.id === record.party_member_id)
                return {
                  ...old,
                  availability: [
                    ...old.availability,
                    {
                      id: record.id,
                      party_member_id: record.party_member_id,
                      date: record.date,
                      available: record.available,
                      updated_at: record.updated_at,
                      party_members: { name: member?.name ?? '' },
                    },
                  ],
                }
              }

              case 'UPDATE': {
                const record = newRecord as {
                  id: string
                  party_member_id: string
                  date: string
                  available: boolean
                  updated_at: string
                }
                return {
                  ...old,
                  availability: old.availability.map((a) =>
                    a.party_member_id === record.party_member_id && a.date === record.date
                      ? { ...a, available: record.available, updated_at: record.updated_at }
                      : a
                  ),
                }
              }

              case 'DELETE': {
                const record = oldRecord as { party_member_id: string; date: string }
                return {
                  ...old,
                  availability: old.availability.filter(
                    (a) => !(a.party_member_id === record.party_member_id && a.date === record.date)
                  ),
                }
              }

              default:
                return old
            }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [partyId, updateCache])

  const getAvailability = useCallback(
    (memberId: string, date: string) => {
      return availability.find(
        (a) => a.party_member_id === memberId && a.date === date
      )
    },
    [availability]
  )

  const countAvailable = useCallback(
    (date: string) => {
      return availability.filter((a) => a.date === date && a.available).length
    },
    [availability]
  )

  // fetchData for backward compatibility (triggers refetch)
  const fetchData = useCallback(
    async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.availability(partyId ?? '') })
    },
    [queryClient, partyId]
  )

  return {
    dates,
    partyMembers,
    availability,
    loading,
    error,
    fetchData,
    setAvailability,
    clearAvailability,
    getAvailability,
    countAvailable,
  }
}
