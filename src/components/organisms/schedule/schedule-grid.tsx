import { useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAvailability } from '@/hooks/useAvailability'
import { useParty } from '@/hooks/useParty'
import { useSessions } from '@/hooks/useSessions'
import { AvailabilityGrid, type GridMember, type GridAvailability, type ScheduledSession } from './availability-grid'
import { ScheduleGridSkeleton } from './schedule-grid-skeleton'
import { SessionTracker } from './session-tracker'

export function ScheduleGrid() {
  const { user } = useAuth()
  const { currentParty, isAdmin, loading: partyLoading } = useParty()
  const {
    dates,
    partyMembers,
    availability: availabilityData,
    loading,
    error,
    getAvailability,
    setAvailability,
    clearAvailability,
  } = useAvailability({
    partyId: currentParty?.id ?? null,
    daysOfWeek: currentParty?.days_of_week,
  })

  // Transform availability data for useSessions
  const availabilityForSessions = availabilityData.map((a) => ({
    memberId: a.party_member_id,
    date: a.date,
    available: a.available,
  }))

  const { sessions } = useSessions({
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
      hostName: s.host_member?.profiles?.display_name || s.host_location || null,
    }))
  }, [sessions])

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
      />
    </>
  )
}
