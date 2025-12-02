import { useAuth } from '../../hooks/useAuth'
import { useAvailability } from '../../hooks/useAvailability'
import { useParty } from '../../hooks/useParty'
import { AvailabilityGrid, type GridMember, type GridAvailability } from './AvailabilityGrid'

export function ScheduleGrid() {
  const { user } = useAuth()
  const { currentParty, isAdmin, loading: partyLoading } = useParty()
  const {
    dates,
    partyMembers,
    loading,
    error,
    getAvailability,
    setAvailability,
    clearAvailability,
  } = useAvailability({ partyId: currentParty?.id ?? null })

  console.log('[ScheduleGrid] render:', {
    hasUser: !!user,
    partyLoading,
    availabilityLoading: loading,
    currentPartyId: currentParty?.id,
    currentPartyName: currentParty?.name,
    error,
    datesCount: dates.length,
    membersCount: partyMembers.length
  })

  if (partyLoading || loading) {
    console.log('[ScheduleGrid] showing loading state:', { partyLoading, availabilityLoading: loading })
    return <div className="loading">Loading schedule...</div>
  }

  if (!currentParty) {
    console.log('[ScheduleGrid] no current party, showing no-party message')
    return (
      <div className="no-party">
        <p>No party selected. Create or join a party to get started.</p>
      </div>
    )
  }

  if (error) {
    console.log('[ScheduleGrid] showing error:', error)
    return <div className="error">Error: {error}</div>
  }

  console.log('[ScheduleGrid] rendering full grid')

  // Transform partyMembers to GridMember format
  const members: GridMember[] = partyMembers.map(member => ({
    id: member.id,
    name: member.profiles?.display_name || member.name,
    avatarUrl: member.profiles?.avatar_url,
    isCurrentUser: member.profile_id === user?.id,
    isLinked: member.profile_id !== null,
  }))

  // Build availability array from the hook's data
  const availability: GridAvailability[] = []
  for (const member of partyMembers) {
    for (const date of dates) {
      const avail = getAvailability(member.id, date)
      if (avail) {
        availability.push({
          memberId: member.id,
          date,
          available: avail.available,
        })
      }
    }
  }

  const handleToggle = (memberId: string, date: string) => {
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
  }

  const canEdit = (memberId: string) => {
    const member = partyMembers.find((m) => m.id === memberId)
    return isAdmin || member?.profile_id === user?.id
  }

  return (
    <AvailabilityGrid
      members={members}
      dates={dates}
      availability={availability}
      onToggle={handleToggle}
      canEdit={canEdit}
      showAdminBadge={isAdmin}
    />
  )
}
