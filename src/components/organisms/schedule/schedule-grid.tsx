import { useMemo, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useAvailability } from '@/hooks/useAvailability'
import { useParty } from '@/hooks/useParty'
import { useSessions } from '@/hooks/useSessions'
import { SCHEDULE } from '@/lib/constants'
import { AvailabilityGrid, type GridMember, type GridAvailability, type ScheduledSession } from './availability-grid'
import { ScheduleGridSkeleton } from './schedule-grid-skeleton'
import { SessionTracker } from './session-tracker'
import { UpcomingDates } from './upcoming-dates'

export function ScheduleGrid() {
  const { user } = useAuth()
  const { currentParty, isAdmin, loading: partyLoading } = useParty()

  // Compute past limit from party creation date
  const pastLimit = useMemo(() => {
    if (!currentParty?.created_at) return null
    return format(parseISO(currentParty.created_at), 'yyyy-MM-dd')
  }, [currentParty?.created_at])

  const {
    dates,
    partyMembers,
    availability: availabilityData,
    loading,
    error,
    getAvailability,
    setAvailability,
    clearAvailability,
    // Infinite scroll
    fetchNextPage,
    fetchPreviousPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
  } = useAvailability({
    partyId: currentParty?.id ?? null,
    daysOfWeek: currentParty?.days_of_week,
    pastLimit,
  })

  // Ref for the scroll container
  const containerRef = useRef<HTMLDivElement>(null)

  // Track scroll position for backward scroll preservation
  const previousScrollWidthRef = useRef(0)
  const lastFetchDirectionRef = useRef<'past' | 'future' | null>(null)

  // Preserve scroll position when prepending past dates
  useLayoutEffect(() => {
    if (lastFetchDirectionRef.current === 'past' && containerRef.current && !isFetchingPreviousPage) {
      const addedWidth = containerRef.current.scrollWidth - previousScrollWidthRef.current
      if (addedWidth > 0) {
        containerRef.current.scrollLeft += addedWidth
      }
      lastFetchDirectionRef.current = null
    }
  }, [dates.length, isFetchingPreviousPage])

  // Scroll detection for infinite loading
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container

      // Near left edge (load past dates)
      if (scrollLeft < SCHEDULE.SCROLL_THRESHOLD && hasPreviousPage && !isFetchingPreviousPage) {
        previousScrollWidthRef.current = scrollWidth
        lastFetchDirectionRef.current = 'past'
        fetchPreviousPage()
      }

      // Near right edge (load future dates)
      if (scrollWidth - scrollLeft - clientWidth < SCHEDULE.SCROLL_THRESHOLD && !isFetchingNextPage) {
        lastFetchDirectionRef.current = 'future'
        fetchNextPage()
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [fetchNextPage, fetchPreviousPage, hasPreviousPage, isFetchingNextPage, isFetchingPreviousPage])

  // Transform availability data for useSessions
  const availabilityForSessions = availabilityData.map((a) => ({
    memberId: a.party_member_id,
    date: a.date,
    available: a.available,
  }))

  const { sessions, scheduleSession, updateSessionHost, unscheduleSession } = useSessions({
    partyId: currentParty?.id ?? null,
    availability: availabilityForSessions,
    memberCount: partyMembers.length,
  })

  // Memoize member transformation - only recalculates when partyMembers or user changes
  const members: GridMember[] = useMemo(
    () =>
      partyMembers.map((member) => ({
        id: member.id,
        name: member.profiles?.display_name || member.name,
        avatarUrl: member.profiles?.avatar_url,
        isCurrentUser: member.profile_id === user?.id,
        isLinked: member.profile_id !== null,
      })),
    [partyMembers, user?.id]
  )

  // Memoize availability array - O(N×M) operation, only rebuild when data changes
  const availability: GridAvailability[] = useMemo(() => {
    const result: GridAvailability[] = []
    for (const member of partyMembers) {
      for (const date of dates) {
        const avail = getAvailability(member.id, date)
        if (avail) {
          result.push({
            memberId: member.id,
            date,
            available: avail.available,
          })
        }
      }
    }
    return result
  }, [partyMembers, dates, getAvailability])

  // Memoize scheduled sessions for grid display
  const scheduledSessions: ScheduledSession[] = useMemo(() => {
    return sessions.map((s) => ({
      date: s.date,
      sessionId: s.id,
      hostName: s.host_member?.profiles?.display_name || s.host_location || null,
    }))
  }, [sessions])

  // Availability map for quick lookup
  const availabilityMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const a of availabilityForSessions) {
      map.set(`${a.memberId}-${a.date}`, a.available)
    }
    return map
  }, [availabilityForSessions])

  // Check if all members are available on a date
  const isAllAvailable = useCallback(
    (date: string) => {
      if (partyMembers.length === 0) return false
      return partyMembers.every((m) => availabilityMap.get(`${m.id}-${date}`) === true)
    },
    [partyMembers, availabilityMap]
  )

  // Memoize toggle handler - stable reference for AvailabilityGrid
  const handleToggle = useCallback(
    (memberId: string, date: string) => {
      const member = partyMembers.find((m) => m.id === memberId)
      const isOwnRow = member?.profile_id === user?.id
      if (!isAdmin && !isOwnRow) return

      const current = getAvailability(memberId, date)
      // Tri-state cycle: unset → available → unavailable → unset
      if (!current) {
        setAvailability(memberId, date, true)
      } else if (current.available) {
        setAvailability(memberId, date, false)
      } else {
        clearAvailability(memberId, date)
      }
    },
    [partyMembers, user?.id, isAdmin, getAvailability, setAvailability, clearAvailability]
  )

  // Memoize canEdit - stable reference for AvailabilityGrid
  const canEdit = useCallback(
    (memberId: string) => {
      const member = partyMembers.find((m) => m.id === memberId)
      return isAdmin || member?.profile_id === user?.id
    },
    [partyMembers, isAdmin, user?.id]
  )

  // Handle scheduling a new session
  const handleSchedule = useCallback(
    async (options: {
      date: string
      hostMemberId?: string | null
      hostLocation?: string | null
      hostAddress?: string | null
      isVirtual?: boolean
    }) => {
      await scheduleSession(options)
    },
    [scheduleSession]
  )

  // Handle updating an existing session
  const handleUpdate = useCallback(
    async (sessionId: string, options: {
      hostMemberId?: string | null
      hostLocation?: string | null
      hostAddress?: string | null
      isVirtual?: boolean
    }) => {
      await updateSessionHost(sessionId, options)
    },
    [updateSessionHost]
  )

  // Handle canceling a session
  const handleCancel = useCallback(
    async (sessionId: string) => {
      await unscheduleSession(sessionId)
    },
    [unscheduleSession]
  )

  // Early returns after all hooks
  if (partyLoading || loading) {
    return <ScheduleGridSkeleton />
  }

  if (!currentParty) {
    return (
      <div className="no-party">
        <p>No party selected. Create or join a party to get started.</p>
      </div>
    )
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>
  }

  return (
    <>
      <SessionTracker />
      <AvailabilityGrid
        members={members}
        dates={dates}
        availability={availability}
        onToggle={handleToggle}
        canEdit={canEdit}
        showAdminBadge={isAdmin}
        scheduledSessions={scheduledSessions}
        containerRef={containerRef}
        isLoadingPast={isFetchingPreviousPage}
        isLoadingFuture={isFetchingNextPage}
      />
      <UpcomingDates
        dates={dates}
        isAllAvailable={isAllAvailable}
        sessions={sessions}
        isAdmin={isAdmin}
        partyMembers={partyMembers}
        party={currentParty}
        onSchedule={handleSchedule}
        onUpdate={handleUpdate}
        onCancel={handleCancel}
      />
    </>
  )
}
