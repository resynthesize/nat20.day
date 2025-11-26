import { useState, useEffect, useCallback } from 'react'
import { supabase, Profile, AvailabilityWithProfile } from '../lib/supabase'
import { generateDates } from '../lib/dates'

interface AvailabilityState {
  dates: string[]
  profiles: Profile[]
  availability: AvailabilityWithProfile[]
  loading: boolean
  error: string | null
}

export function useAvailability() {
  const [state, setState] = useState<AvailabilityState>({
    dates: [],
    profiles: [],
    availability: [],
    loading: true,
    error: null,
  })

  // Fetch all data
  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))

    try {
      const dates = generateDates(8)
      const fromDate = dates[0]
      const toDate = dates[dates.length - 1]

      // Fetch profiles and availability in parallel
      const [profilesResult, availabilityResult] = await Promise.all([
        supabase.from('profiles').select('*').order('display_name'),
        supabase
          .from('availability')
          .select(
            `
            id,
            user_id,
            date,
            available,
            updated_at,
            profiles!inner (
              display_name,
              avatar_url
            )
          `
          )
          .gte('date', fromDate)
          .lte('date', toDate)
          .order('date'),
      ])

      if (profilesResult.error) throw profilesResult.error
      if (availabilityResult.error) throw availabilityResult.error

      setState({
        dates,
        profiles: profilesResult.data as Profile[],
        availability: availabilityResult.data as AvailabilityWithProfile[],
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

  // Set availability for a date
  const setAvailability = useCallback(
    async (userId: string, date: string, available: boolean) => {
      // Optimistic update
      setState((s) => {
        const existing = s.availability.find(
          (a) => a.user_id === userId && a.date === date
        )

        if (existing) {
          return {
            ...s,
            availability: s.availability.map((a) =>
              a.user_id === userId && a.date === date ? { ...a, available } : a
            ),
          }
        }

        // Add new entry (we'll need profile info)
        const profile = s.profiles.find((p) => p.id === userId)
        if (!profile) return s

        return {
          ...s,
          availability: [
            ...s.availability,
            {
              id: `temp-${userId}-${date}`,
              user_id: userId,
              date,
              available,
              updated_at: new Date().toISOString(),
              profiles: {
                display_name: profile.display_name,
                avatar_url: profile.avatar_url,
              },
            },
          ],
        }
      })

      // Persist to database
      const { error } = await supabase
        .from('availability')
        .upsert({ user_id: userId, date, available }, { onConflict: 'user_id,date' })

      if (error) {
        console.error('Error setting availability:', error)
        // Revert on error
        fetchData()
      }
    },
    [fetchData]
  )

  // Clear availability for a date
  const clearAvailability = useCallback(
    async (userId: string, date: string) => {
      // Optimistic update
      setState((s) => ({
        ...s,
        availability: s.availability.filter(
          (a) => !(a.user_id === userId && a.date === date)
        ),
      }))

      // Delete from database
      const { error } = await supabase
        .from('availability')
        .delete()
        .eq('user_id', userId)
        .eq('date', date)

      if (error) {
        console.error('Error clearing availability:', error)
        fetchData()
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
          // Refetch on any change
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  // Helper to get availability for a specific user and date
  const getAvailability = useCallback(
    (userId: string, date: string) => {
      return state.availability.find(
        (a) => a.user_id === userId && a.date === date
      )
    },
    [state.availability]
  )

  // Helper to count available users for a date
  const countAvailable = useCallback(
    (date: string) => {
      return state.availability.filter((a) => a.date === date && a.available)
        .length
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
