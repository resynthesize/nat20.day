import { useCallback, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { differenceInDays, parseISO, isBefore, isAfter, startOfDay } from 'date-fns'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { parseSessionsWithHost, type SessionWithHost } from '../lib/schemas'
import { CACHE } from '../lib/constants'
import { useAuth } from './useAuth'

interface UseSessionsOptions {
  partyId: string | null
  // Availability data to find suggestion dates
  availability?: Array<{ memberId: string; date: string; available: boolean }>
  memberCount?: number
}

interface ScheduleSessionOptions {
  date: string
  hostMemberId?: string | null
  hostLocation?: string | null
  hostAddress?: string | null
  isVirtual?: boolean
  startTime?: string | null
}

interface UseSessionsReturn {
  sessions: SessionWithHost[]
  lastSession: SessionWithHost | null
  nextScheduledSession: SessionWithHost | null
  daysSinceLastSession: number | null
  suggestedDate: string | null
  confirmSession: (date: string) => Promise<void>
  scheduleSession: (options: ScheduleSessionOptions) => Promise<void>
  unscheduleSession: (sessionId: string) => Promise<void>
  updateSessionHost: (sessionId: string, options: Omit<ScheduleSessionOptions, 'date'>) => Promise<void>
  loading: boolean
  error: string | null
}

// D&D-themed messages based on days since last session
export const getSessionFlavorText = (days: number | null): string => {
  if (days === null) return 'No sessions logged yet. When did you last play?'
  if (days <= 7) return 'The party rests at the tavern'
  if (days <= 14) return 'Cobwebs gather on your dice'
  if (days <= 30) return 'Your character sheets grow dusty'
  if (days <= 60) return 'The BBEG wonders if you forgot about them'
  return 'A bard writes a song about the adventurers who never returned'
}

export function useSessions({
  partyId,
  availability = [],
  memberCount = 0,
}: UseSessionsOptions): UseSessionsReturn {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Fetch sessions for this party with host data
  const {
    data: sessions = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.sessions(partyId ?? ''),
    queryFn: async () => {
      if (!partyId) return []

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          host_member:party_members!sessions_host_member_id_fkey (
            id,
            name,
            profiles (
              display_name,
              avatar_url,
              address
            )
          )
        `)
        .eq('party_id', partyId)
        .order('date', { ascending: false })

      if (error) throw error
      return parseSessionsWithHost(data)
    },
    enabled: !!partyId,
    staleTime: CACHE.STALE_TIME_DEFAULT,
  })

  // Real-time subscription for session changes
  useEffect(() => {
    if (!partyId) return

    const channel = supabase
      .channel(`sessions:${partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `party_id=eq.${partyId}`,
        },
        () => {
          // Invalidate query to refetch on any change
          queryClient.invalidateQueries({ queryKey: queryKeys.sessions(partyId) })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [partyId, queryClient])

  // Find the most recent past session
  const lastSession = useMemo(() => {
    const today = startOfDay(new Date())
    const pastSessions = sessions.filter((s) => {
      const sessionDate = parseISO(s.date)
      return isBefore(sessionDate, today) || sessionDate.getTime() === today.getTime()
    })
    return pastSessions.length > 0 ? pastSessions[0] : null // Already sorted DESC
  }, [sessions])

  // Find the next scheduled future session
  const nextScheduledSession = useMemo(() => {
    const today = startOfDay(new Date())
    const futureSessions = sessions.filter((s) => {
      const sessionDate = parseISO(s.date)
      return isAfter(sessionDate, today)
    })
    // Return the soonest future session
    return futureSessions.length > 0 ? futureSessions[futureSessions.length - 1] : null
  }, [sessions])

  // Calculate days since last session
  const daysSinceLastSession = useMemo(() => {
    if (!lastSession) return null
    const lastDate = parseISO(lastSession.date)
    const today = startOfDay(new Date())
    return differenceInDays(today, lastDate)
  }, [lastSession])

  // Find a suggested date: past date where all members were available, no session logged
  const suggestedDate = useMemo(() => {
    if (memberCount === 0 || availability.length === 0) return null

    const today = startOfDay(new Date())
    const sessionDates = new Set(sessions.map((s) => s.date))

    // Group availability by date
    const availabilityByDate = new Map<string, number>()
    for (const a of availability) {
      if (a.available) {
        const count = availabilityByDate.get(a.date) ?? 0
        availabilityByDate.set(a.date, count + 1)
      }
    }

    // Find past dates where all members were available and no session exists
    const candidates: string[] = []
    for (const [date, count] of availabilityByDate) {
      const dateObj = parseISO(date)
      const isPast = isBefore(dateObj, today)
      const allAvailable = count === memberCount
      const noSession = !sessionDates.has(date)

      if (isPast && allAvailable && noSession) {
        candidates.push(date)
      }
    }

    // Return the most recent candidate
    if (candidates.length === 0) return null
    candidates.sort((a, b) => b.localeCompare(a)) // DESC
    return candidates[0]
  }, [availability, memberCount, sessions])

  // Mutation to confirm a session happened (simple, no host info)
  const confirmMutation = useMutation({
    mutationFn: async (date: string) => {
      if (!partyId || !user) throw new Error('Not authenticated')

      const { error } = await supabase.from('sessions').insert({
        party_id: partyId,
        date,
        confirmed_by: user.id,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions(partyId ?? '') })
    },
  })

  // Mutation to schedule a session with host info
  const scheduleMutation = useMutation({
    mutationFn: async (options: ScheduleSessionOptions) => {
      if (!partyId || !user) throw new Error('Not authenticated')

      const { error } = await supabase.from('sessions').insert({
        party_id: partyId,
        date: options.date,
        confirmed_by: user.id,
        host_member_id: options.hostMemberId || null,
        host_location: options.hostLocation || null,
        host_address: options.hostAddress || null,
        is_virtual: options.isVirtual ?? false,
        start_time: options.startTime || null,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions(partyId ?? '') })
    },
  })

  // Mutation to unschedule (delete) a session
  const unscheduleMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!partyId || !user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)
        .eq('party_id', partyId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions(partyId ?? '') })
    },
  })

  // Mutation to update host info on an existing session
  const updateHostMutation = useMutation({
    mutationFn: async ({ sessionId, options }: { sessionId: string; options: Omit<ScheduleSessionOptions, 'date'> }) => {
      if (!partyId || !user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('sessions')
        .update({
          host_member_id: options.hostMemberId || null,
          host_location: options.hostLocation || null,
          host_address: options.hostAddress || null,
          is_virtual: options.isVirtual ?? false,
          start_time: options.startTime || null,
        })
        .eq('id', sessionId)
        .eq('party_id', partyId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions(partyId ?? '') })
    },
  })

  const confirmSession = useCallback(
    async (date: string) => {
      await confirmMutation.mutateAsync(date)
    },
    [confirmMutation]
  )

  const scheduleSession = useCallback(
    async (options: ScheduleSessionOptions) => {
      await scheduleMutation.mutateAsync(options)
    },
    [scheduleMutation]
  )

  const unscheduleSession = useCallback(
    async (sessionId: string) => {
      await unscheduleMutation.mutateAsync(sessionId)
    },
    [unscheduleMutation]
  )

  const updateSessionHost = useCallback(
    async (sessionId: string, options: Omit<ScheduleSessionOptions, 'date'>) => {
      await updateHostMutation.mutateAsync({ sessionId, options })
    },
    [updateHostMutation]
  )

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Failed to load sessions'
    : null

  return {
    sessions,
    lastSession,
    nextScheduledSession,
    daysSinceLastSession,
    suggestedDate,
    confirmSession,
    scheduleSession,
    unscheduleSession,
    updateSessionHost,
    loading,
    error,
  }
}
