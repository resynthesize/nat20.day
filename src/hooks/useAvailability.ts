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
import { STORAGE_KEYS, CACHE } from '../lib/constants'

interface AvailabilityData {
  dates: string[]
  partyMembers: PartyMember[]
  availability: AvailabilityWithMember[]
}

interface UseAvailabilityOptions {
  partyId: string | null
  daysOfWeek?: number[]
}

// Exported for prefetching
export async function fetchAvailabilityData(
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
    localStorage.setItem(STORAGE_KEYS.LAST_MEMBER_COUNT, String(parsedMembers.length))
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

  // Track pending mutations by (memberId, date) key with their start timestamp
  // This prevents real-time events from our own mutations causing UI flash
  const pendingMutationsRef = useRef<Map<string, number>>(new Map())

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
    gcTime: CACHE.GC_TIME_DEFAULT,
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
      const mutationKey = `${memberId}-${date}`
      const mutationTime = Date.now()
      pendingMutationsRef.current.set(mutationKey, mutationTime)

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

      // Clear pending mutation after server confirms (or errors)
      pendingMutationsRef.current.delete(mutationKey)

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
      const mutationKey = `${memberId}-${date}`
      const mutationTime = Date.now()
      pendingMutationsRef.current.set(mutationKey, mutationTime)

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

      // Clear pending mutation after server confirms (or errors)
      pendingMutationsRef.current.delete(mutationKey)

      if (error) {
        console.error('Error clearing availability:', error)
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
          const { eventType, new: newRecord, old: oldRecord } = payload

          // Extract member ID and date from the record
          const memberId = (newRecord as { party_member_id?: string })?.party_member_id ||
                           (oldRecord as { party_member_id?: string })?.party_member_id
          const date = (newRecord as { date?: string })?.date ||
                       (oldRecord as { date?: string })?.date

          if (!memberId || !date) return

          // Check if we have a pending mutation for this (memberId, date)
          const mutationKey = `${memberId}-${date}`
          const pendingMutationTime = pendingMutationsRef.current.get(mutationKey)

          if (pendingMutationTime) {
            // Compare with the event's updated_at timestamp
            const eventTime = (newRecord as { updated_at?: string })?.updated_at
            if (eventTime) {
              const eventTimestamp = new Date(eventTime).getTime()
              // If the event is from our own mutation or older, skip it
              // Allow a small buffer (100ms) for clock skew
              if (eventTimestamp <= pendingMutationTime + 100) {
                return
              }
            } else {
              // For DELETE events, we don't have updated_at on newRecord
              // Skip if we have a pending mutation (it's likely our own delete echoing back)
              return
            }
          }

          updateCache((old) => {
            if (!old) return old

            // Only process if this availability belongs to a member in our party
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
