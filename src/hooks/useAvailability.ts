import { useEffect, useCallback, useRef, useMemo } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import {
  parsePartyMembers,
  parseAvailabilityWithMembers,
  type PartyMember,
  type AvailabilityWithMember,
} from '../lib/schemas'
import { generateDates, generateDatesBefore, generateDatesAfter } from '../lib/dates'
import { STORAGE_KEYS, CACHE, SCHEDULE } from '../lib/constants'

/**
 * Realtime payload schemas for availability changes
 */
const AvailabilityRealtimeRecordSchema = z.object({
  id: z.string(),
  party_member_id: z.string(),
  date: z.string(),
  available: z.boolean(),
  updated_at: z.string(),
})
type AvailabilityRealtimeRecord = z.infer<typeof AvailabilityRealtimeRecordSchema>

const AvailabilityDeleteRecordSchema = z.object({
  party_member_id: z.string(),
  date: z.string(),
})
type AvailabilityDeleteRecord = z.infer<typeof AvailabilityDeleteRecordSchema>

// Parse helpers that return null on failure
function parseRealtimeRecord(obj: unknown): AvailabilityRealtimeRecord | null {
  const result = AvailabilityRealtimeRecordSchema.safeParse(obj)
  return result.success ? result.data : null
}

function parseDeleteRecord(obj: unknown): AvailabilityDeleteRecord | null {
  const result = AvailabilityDeleteRecordSchema.safeParse(obj)
  return result.success ? result.data : null
}

interface AvailabilityData {
  dates: string[]
  partyMembers: PartyMember[]
  availability: AvailabilityWithMember[]
}

interface AvailabilityPage {
  dates: string[]
  availability: AvailabilityWithMember[]
  partyMembers: PartyMember[] // Only populated on initial page
  range: { start: string; end: string }
}

type PageDirection = 'initial' | 'past' | 'future'

interface PageParam {
  direction: PageDirection
  cursor: string // Date string to fetch from
}

interface UseAvailabilityOptions {
  partyId: string | null
  daysOfWeek?: number[]
  pastLimit?: string | null // Party creation date - stop scrolling back at this point
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
          avatar_url,
          address
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

// Fetch availability for a specific date range (for infinite scroll pagination)
async function fetchAvailabilityPage(
  partyId: string,
  dates: string[],
  includeMembers: boolean
): Promise<AvailabilityPage> {
  if (dates.length === 0) {
    return {
      dates: [],
      availability: [],
      partyMembers: [],
      range: { start: '', end: '' },
    }
  }

  const fromDate = dates[0]
  const toDate = dates[dates.length - 1]

  // Fetch availability
  const availabilityResult = await supabase
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
    .order('date')

  if (availabilityResult.error) throw availabilityResult.error

  // Normalize availability data
  const normalizedAvailability = (availabilityResult.data ?? []).map((item) => ({
    ...item,
    party_members: Array.isArray(item.party_members)
      ? item.party_members[0]
      : item.party_members,
  }))

  // Only fetch members on initial page
  let parsedMembers: PartyMember[] = []
  if (includeMembers) {
    const membersResult = await supabase
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
          avatar_url,
          address
        )
      `)
      .eq('party_id', partyId)
      .order('name')

    if (membersResult.error) throw membersResult.error

    const normalizedMembers = (membersResult.data ?? []).map((item) => ({
      ...item,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
    }))
    parsedMembers = parsePartyMembers(normalizedMembers)

    // Persist member count for skeleton loading state
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_MEMBER_COUNT, String(parsedMembers.length))
    } catch {
      // localStorage may not be available
    }
  }

  return {
    dates,
    availability: parseAvailabilityWithMembers(normalizedAvailability),
    partyMembers: parsedMembers,
    range: { start: fromDate, end: toDate },
  }
}

// Merge all pages into a single sorted dataset
function mergePages(pages: AvailabilityPage[]): AvailabilityData {
  const allDates = new Set<string>()
  const allAvailability: AvailabilityWithMember[] = []
  let partyMembers: PartyMember[] = []

  // First pass: collect party members from any page that has them
  for (const page of pages) {
    if (page?.partyMembers?.length > 0) {
      partyMembers = page.partyMembers
      break // Party members should be the same across pages
    }
  }

  // Filter pages with valid dates and sort
  const pagesWithDates = pages.filter((p) => p?.dates?.length > 0)
  const sortedPages = [...pagesWithDates].sort((a, b) => {
    return a.dates[0].localeCompare(b.dates[0])
  })

  for (const page of sortedPages) {
    page.dates.forEach((d) => allDates.add(d))
    if (page.availability) {
      allAvailability.push(...page.availability)
    }
  }

  return {
    dates: Array.from(allDates).sort(),
    availability: allAvailability,
    partyMembers,
  }
}

export function useAvailability({ partyId, daysOfWeek, pastLimit }: UseAvailabilityOptions) {
  const queryClient = useQueryClient()

  // Track pending mutations by (memberId, date) key with their start timestamp
  // This prevents real-time events from our own mutations causing UI flash
  const pendingMutationsRef = useRef<Map<string, number>>(new Map())

  // Track currently loaded dates for real-time subscription validation
  const loadedDatesRef = useRef<Set<string>>(new Set())

  // Cache party members separately - they don't change with pagination
  // and we don't want to lose them when maxPages drops the initial page
  const partyMembersCache = useRef<PartyMember[]>([])

  // Clear cache when party changes
  useEffect(() => {
    partyMembersCache.current = []
  }, [partyId])

  // Resolve allowed days with fallback
  const resolvedDaysOfWeek = useMemo(
    () => daysOfWeek ?? [...SCHEDULE.DEFAULT_DAYS],
    [daysOfWeek]
  )

  // TanStack Infinite Query for paginated fetch
  const {
    data: infiniteData,
    isLoading: loading,
    error: queryError,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.availability(partyId ?? ''),
    queryFn: async ({ pageParam }): Promise<AvailabilityPage> => {
      const { direction, cursor } = pageParam as PageParam

      let dates: string[]
      if (direction === 'initial') {
        // Initial load: 8 weeks from today
        dates = generateDates(SCHEDULE.WEEKS_TO_DISPLAY, resolvedDaysOfWeek)
      } else if (direction === 'past') {
        // Load older dates
        dates = generateDatesBefore(cursor, SCHEDULE.WEEKS_PER_CHUNK, resolvedDaysOfWeek)
        // Filter out dates before pastLimit
        if (pastLimit) {
          dates = dates.filter((d) => d >= pastLimit)
        }
      } else {
        // Load future dates
        dates = generateDatesAfter(cursor, SCHEDULE.WEEKS_PER_CHUNK, resolvedDaysOfWeek)
      }

      return fetchAvailabilityPage(partyId!, dates, direction === 'initial')
    },
    initialPageParam: { direction: 'initial', cursor: '' } as PageParam,
    getNextPageParam: (lastPage): PageParam | undefined => {
      if (!lastPage?.dates?.length) return undefined
      return { direction: 'future', cursor: lastPage.dates[lastPage.dates.length - 1] }
    },
    getPreviousPageParam: (firstPage): PageParam | undefined => {
      if (!firstPage?.dates?.length) return undefined
      const firstDate = firstPage.dates[0]
      // Stop if we've reached the past limit
      if (pastLimit && firstDate <= pastLimit) return undefined
      return { direction: 'past', cursor: firstDate }
    },
    enabled: !!partyId,
    // Limit pages to keep scrollbar size reasonable - drop far pages when loading new ones
    maxPages: 5,
    // Never automatically refetch - real-time handles updates
    staleTime: Infinity,
    gcTime: CACHE.GC_TIME_DEFAULT,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })

  // Merge all pages into single dataset
  const mergedData = useMemo(
    () => (infiniteData ? mergePages(infiniteData.pages) : null),
    [infiniteData]
  )

  // Update party members cache when we get new members data
  // This persists members even when maxPages drops the initial page
  if (mergedData?.partyMembers?.length) {
    partyMembersCache.current = mergedData.partyMembers
  }

  // Default values when no data
  const dates = mergedData?.dates ?? []
  // Use cached party members if current pages don't have them (dropped by maxPages)
  const partyMembers = mergedData?.partyMembers?.length ? mergedData.partyMembers : partyMembersCache.current
  const availability = useMemo(() => mergedData?.availability ?? [], [mergedData?.availability])
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch data') : null

  // Update loaded dates ref when dates change (for real-time subscription)
  useEffect(() => {
    loadedDatesRef.current = new Set(dates)
  }, [dates])

  // Helper to update cache - works with infinite query structure
  const updateCache = useCallback(
    (updater: (old: AvailabilityData | undefined) => AvailabilityData | undefined) => {
      // For infinite queries, we need to update the pages structure
      queryClient.setQueryData(
        queryKeys.availability(partyId ?? ''),
        (oldData: { pages: AvailabilityPage[]; pageParams: PageParam[] } | undefined) => {
          if (!oldData) return oldData

          // Merge current pages to get combined data, then apply updater
          const merged = mergePages(oldData.pages)
          const updated = updater(merged)
          if (!updated || updated === merged) return oldData

          // Find which page contains each availability record and update it
          // For simplicity, update the first page that has the initial data
          return {
            ...oldData,
            pages: oldData.pages.map((page, index) => {
              if (index === 0) {
                // Update partyMembers on first page
                return {
                  ...page,
                  partyMembers: updated.partyMembers,
                  availability: updated.availability.filter((a) => page.dates.includes(a.date)),
                }
              }
              return {
                ...page,
                availability: updated.availability.filter((a) => page.dates.includes(a.date)),
              }
            }),
          }
        }
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

          // Parse records using Zod schemas
          const parsedNew = parseRealtimeRecord(newRecord)
          const parsedOld = parseDeleteRecord(oldRecord)

          // Extract member ID and date from the record
          const memberId = parsedNew?.party_member_id ?? parsedOld?.party_member_id
          const date = parsedNew?.date ?? parsedOld?.date

          if (!memberId || !date) return

          // Check if we have a pending mutation for this (memberId, date)
          const mutationKey = `${memberId}-${date}`
          const pendingMutationTime = pendingMutationsRef.current.get(mutationKey)

          if (pendingMutationTime) {
            // Compare with the event's updated_at timestamp
            if (parsedNew?.updated_at) {
              const eventTimestamp = new Date(parsedNew.updated_at).getTime()
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
                if (!parsedNew) return old
                // Check if date is within our dynamically loaded range
                if (!loadedDatesRef.current.has(parsedNew.date)) return old
                // Avoid duplicates (might already exist from optimistic update)
                const exists = old.availability.some(
                  (a) => a.party_member_id === parsedNew.party_member_id && a.date === parsedNew.date
                )
                if (exists) {
                  // Update existing record
                  return {
                    ...old,
                    availability: old.availability.map((a) =>
                      a.party_member_id === parsedNew.party_member_id && a.date === parsedNew.date
                        ? { ...a, id: parsedNew.id, available: parsedNew.available, updated_at: parsedNew.updated_at }
                        : a
                    ),
                  }
                }
                // Add new record
                const member = old.partyMembers.find((m) => m.id === parsedNew.party_member_id)
                return {
                  ...old,
                  availability: [
                    ...old.availability,
                    {
                      id: parsedNew.id,
                      party_member_id: parsedNew.party_member_id,
                      date: parsedNew.date,
                      available: parsedNew.available,
                      updated_at: parsedNew.updated_at,
                      party_members: { name: member?.name ?? '' },
                    },
                  ],
                }
              }

              case 'UPDATE': {
                if (!parsedNew) return old
                return {
                  ...old,
                  availability: old.availability.map((a) =>
                    a.party_member_id === parsedNew.party_member_id && a.date === parsedNew.date
                      ? { ...a, available: parsedNew.available, updated_at: parsedNew.updated_at }
                      : a
                  ),
                }
              }

              case 'DELETE': {
                if (!parsedOld) return old
                return {
                  ...old,
                  availability: old.availability.filter(
                    (a) => !(a.party_member_id === parsedOld.party_member_id && a.date === parsedOld.date)
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
    // Infinite scroll methods
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage: hasNextPage ?? true, // Always can load more future dates
    hasPreviousPage: hasPreviousPage ?? false,
    isFetchingNextPage,
    isFetchingPreviousPage,
  }
}
