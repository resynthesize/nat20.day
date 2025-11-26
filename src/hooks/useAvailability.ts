import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PartyMember, AvailabilityWithMember } from '../lib/supabase'
import { generateDates } from '../lib/dates'

interface AvailabilityState {
  dates: string[]
  partyMembers: PartyMember[]
  availability: AvailabilityWithMember[]
  loading: boolean
  error: string | null
}

export function useAvailability() {
  const [state, setState] = useState<AvailabilityState>({
    dates: [],
    partyMembers: [],
    availability: [],
    loading: true,
    error: null,
  })

  // Fetch all data (showLoading=false for background refetches)
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setState((s) => ({ ...s, loading: true, error: null }))
    }

    try {
      const dates = generateDates(8)
      const fromDate = dates[0]
      const toDate = dates[dates.length - 1]

      // Fetch party members (with linked profile data) and availability in parallel
      const [membersResult, availabilityResult] = await Promise.all([
        supabase
          .from('party_members')
          .select(`
            id,
            name,
            email,
            profile_id,
            created_at,
            profiles (
              display_name,
              avatar_url
            )
          `)
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
              name
            )
          `)
          .gte('date', fromDate)
          .lte('date', toDate)
          .order('date'),
      ])

      if (membersResult.error) throw membersResult.error
      if (availabilityResult.error) throw availabilityResult.error

      // Transform data - Supabase returns profiles as array sometimes
      const partyMembers = membersResult.data.map((item) => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
      })) as PartyMember[]

      const availability = availabilityResult.data.map((item) => ({
        ...item,
        party_members: Array.isArray(item.party_members) ? item.party_members[0] : item.party_members,
      })) as AvailabilityWithMember[]

      setState({
        dates,
        partyMembers,
        availability,
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
  }, [])

  // Set availability for a party member on a date
  const setAvailability = useCallback(
    async (memberId: string, date: string, available: boolean) => {
      // Optimistic update
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

        // Add new entry
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

      // Persist to database
      const { error } = await supabase
        .from('availability')
        .upsert(
          { party_member_id: memberId, date, available },
          { onConflict: 'party_member_id,date' }
        )

      if (error) {
        console.error('Error setting availability:', error)
        // Revert on error
        fetchData(false)
      }
    },
    [fetchData]
  )

  // Clear availability for a party member on a date
  const clearAvailability = useCallback(
    async (memberId: string, date: string) => {
      // Optimistic update
      setState((s) => ({
        ...s,
        availability: s.availability.filter(
          (a) => !(a.party_member_id === memberId && a.date === date)
        ),
      }))

      // Delete from database
      const { error } = await supabase
        .from('availability')
        .delete()
        .eq('party_member_id', memberId)
        .eq('date', date)

      if (error) {
        console.error('Error clearing availability:', error)
        fetchData(false)
      }
    },
    [fetchData]
  )

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('availability-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'availability' },
        () => {
          // Refetch on any change (no loading spinner for background updates)
          fetchData(false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  // Helper to get availability for a specific member and date
  const getAvailability = useCallback(
    (memberId: string, date: string) => {
      return state.availability.find(
        (a) => a.party_member_id === memberId && a.date === date
      )
    },
    [state.availability]
  )

  // Helper to count available members for a date
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
