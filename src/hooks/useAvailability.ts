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
  console.log('[Availability] useAvailability hook called with partyId:', partyId)

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
    console.log('[Availability] fetchData: starting', { partyId, showLoading })

    // Don't fetch if no party is selected
    if (!partyId) {
      console.log('[Availability] fetchData: no partyId, clearing state')
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
      console.log('[Availability] fetchData: setting loading=true')
      setState((s) => ({ ...s, loading: true, error: null }))
    }

    try {
      const dates = generateDates(8, daysOfWeek)
      const fromDate = dates[0]
      const toDate = dates[dates.length - 1]
      console.log('[Availability] fetchData: querying supabase', { fromDate, toDate, daysOfWeek })

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

      console.log('[Availability] fetchData: query results', {
        membersError: membersResult.error,
        membersCount: membersResult.data?.length,
        availabilityError: availabilityResult.error,
        availabilityCount: availabilityResult.data?.length
      })

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

      console.log('[Availability] fetchData: setting final state', {
        datesCount: dates.length,
        membersCount: normalizedMembers.length,
        availabilityCount: normalizedAvailability.length
      })

      setState({
        dates,
        partyMembers: parsePartyMembers(normalizedMembers),
        availability: parseAvailabilityWithMembers(normalizedAvailability),
        loading: false,
        error: null,
      })
    } catch (err) {
      console.error('[Availability] fetchData: ERROR', err)
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
    console.log('[Availability] useEffect: partyId changed, calling fetchData', { partyId })
    fetchData()
  }, [fetchData, partyId])

  // Subscribe to realtime updates
  useEffect(() => {
    if (!partyId) return

    const channel = supabase
      .channel(`availability-changes-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'availability' },
        () => {
          // Skip refresh during local mutations to prevent flash
          if (!mutatingRef.current) {
            fetchData(false)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData, partyId])

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
