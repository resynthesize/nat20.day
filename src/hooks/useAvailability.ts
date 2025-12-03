import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  parsePartyMembers,
  parseAvailabilityWithMembers,
  type PartyMember,
  type AvailabilityWithMember,
} from '../lib/schemas'
import { generateDates } from '../lib/dates'

interface AvailabilityState {
  dates: string[]
  partyMembers: PartyMember[]
  availability: AvailabilityWithMember[]
  loading: boolean
  error: string | null
}

interface UseAvailabilityOptions {
  partyId: string | null
  daysOfWeek?: number[]
}

export function useAvailability({ partyId, daysOfWeek }: UseAvailabilityOptions) {
  const [state, setState] = useState<AvailabilityState>({
    dates: [],
    partyMembers: [],
    availability: [],
    loading: true,
    error: null,
  })

  // Skip realtime refreshes during local mutations to prevent flash
  const mutatingRef = useRef(false)

  const fetchData = useCallback(async (showLoading = true) => {
    // Don't fetch if no party is selected
    if (!partyId) {
      setState({
        dates: [],
        partyMembers: [],
        availability: [],
        loading: false,
        error: null,
      })
      return
    }

    if (showLoading) {
      setState((s) => ({ ...s, loading: true, error: null }))
    }

    try {
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

      setState({
        dates,
        partyMembers: parsePartyMembers(normalizedMembers),
        availability: parseAvailabilityWithMembers(normalizedAvailability),
        loading: false,
        error: null,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch data',
      }))
    }
  }, [partyId, daysOfWeek])

  const setAvailability = useCallback(
    async (memberId: string, date: string, available: boolean) => {
      setState((s) => {
        const existing = s.availability.find(
          (a) => a.party_member_id === memberId && a.date === date
        )

        if (existing) {
          return {
            ...s,
            availability: s.availability.map((a) =>
              a.party_member_id === memberId && a.date === date ? { ...a, available } : a
            ),
          }
        }

        const member = s.partyMembers.find((m) => m.id === memberId)
        if (!member) return s

        return {
          ...s,
          availability: [
            ...s.availability,
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

      if (error) {
        console.error('Error setting availability:', error)
        fetchData(false)
      }
    },
    [fetchData]
  )

  const clearAvailability = useCallback(
    async (memberId: string, date: string) => {
      mutatingRef.current = true

      setState((s) => ({
        ...s,
        availability: s.availability.filter(
          (a) => !(a.party_member_id === memberId && a.date === date)
        ),
      }))

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
        fetchData(false)
      }
    },
    [fetchData]
  )

  // Fetch data when partyId changes
  useEffect(() => {
    fetchData()
  }, [fetchData, partyId])

  // Subscribe to realtime updates with incremental merging
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

          // Incremental merge: update only the changed record instead of full refetch
          const { eventType, new: newRecord, old: oldRecord } = payload

          setState((s) => {
            // Only process if this availability belongs to a member in our party
            const memberId = (newRecord as { party_member_id?: string })?.party_member_id ||
                             (oldRecord as { party_member_id?: string })?.party_member_id
            const memberInParty = s.partyMembers.some((m) => m.id === memberId)
            if (!memberInParty) return s

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
                if (!s.dates.includes(record.date)) return s
                // Avoid duplicates (might already exist from optimistic update)
                const exists = s.availability.some(
                  (a) => a.party_member_id === record.party_member_id && a.date === record.date
                )
                if (exists) {
                  // Update existing record
                  return {
                    ...s,
                    availability: s.availability.map((a) =>
                      a.party_member_id === record.party_member_id && a.date === record.date
                        ? { ...a, id: record.id, available: record.available, updated_at: record.updated_at }
                        : a
                    ),
                  }
                }
                // Add new record
                const member = s.partyMembers.find((m) => m.id === record.party_member_id)
                return {
                  ...s,
                  availability: [
                    ...s.availability,
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
                  ...s,
                  availability: s.availability.map((a) =>
                    a.party_member_id === record.party_member_id && a.date === record.date
                      ? { ...a, available: record.available, updated_at: record.updated_at }
                      : a
                  ),
                }
              }

              case 'DELETE': {
                const record = oldRecord as { party_member_id: string; date: string }
                return {
                  ...s,
                  availability: s.availability.filter(
                    (a) => !(a.party_member_id === record.party_member_id && a.date === record.date)
                  ),
                }
              }

              default:
                return s
            }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [partyId]) // Removed fetchData dependency - no longer needed for incremental updates

  const getAvailability = useCallback(
    (memberId: string, date: string) => {
      return state.availability.find(
        (a) => a.party_member_id === memberId && a.date === date
      )
    },
    [state.availability]
  )

  const countAvailable = useCallback(
    (date: string) => {
      return state.availability.filter((a) => a.date === date && a.available).length
    },
    [state.availability]
  )

  return {
    ...state,
    fetchData,
    setAvailability,
    clearAvailability,
    getAvailability,
    countAvailable,
  }
}
