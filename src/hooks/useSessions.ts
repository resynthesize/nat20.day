import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { differenceInDays, parseISO, isBefore, startOfDay } from 'date-fns'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { parseSessions, type Session } from '../lib/schemas'
import { useAuth } from './useAuth'

interface UseSessionsOptions {
  partyId: string | null
  // Availability data to find suggestion dates
  availability?: Array<{ memberId: string; date: string; available: boolean }>
  memberCount?: number
}

interface UseSessionsReturn {
  sessions: Session[]
  lastSession: Session | null
  daysSinceLastSession: number | null
  suggestedDate: string | null
  confirmSession: (date: string) => Promise<void>
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

  // Fetch sessions for this party
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
        .select('*')
        .eq('party_id', partyId)
        .order('date', { ascending: false })

      if (error) throw error
      return parseSessions(data)
    },
    enabled: !!partyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Find the most recent session
  const lastSession = useMemo(() => {
    if (sessions.length === 0) return null
    return sessions[0] // Already sorted DESC
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

  // Mutation to confirm a session happened
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

  const confirmSession = useCallback(
    async (date: string) => {
      await confirmMutation.mutateAsync(date)
    },
    [confirmMutation]
  )

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Failed to load sessions'
    : null

  return {
    sessions,
    lastSession,
    daysSinceLastSession,
    suggestedDate,
    confirmSession,
    loading,
    error,
  }
}
