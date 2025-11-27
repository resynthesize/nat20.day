import { useAuth } from '../../hooks/useAuth'
import { useAvailability } from '../../hooks/useAvailability'
import { formatDateDisplay, getDayOfWeek } from '../../lib/dates'
import type { PartyMember } from '../../lib/schemas'

export function ScheduleGrid() {
  const { user, profile } = useAuth()
  const {
    dates,
    partyMembers,
    loading,
    error,
    getAvailability,
    setAvailability,
    clearAvailability,
    countAvailable,
  } = useAvailability()

  const isAdmin = profile?.is_admin ?? false

  if (loading) {
    return <div className="loading">Loading schedule...</div>
  }

  if (error) {
    return <div className="error">Error: {error}</div>
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

  const isAllAvailable = (date: string) => {
    return countAvailable(date) === partyMembers.length && partyMembers.length > 0
  }

  return (
    <div className="schedule-container">
      {isAdmin && (
        <div className="admin-badge">Admin Mode - You can edit all schedules</div>
      )}
      <div
        className="schedule-grid"
        style={{ '--date-columns': dates.length } as React.CSSProperties}
      >
        <div className="grid-header">
          <div className="player-label">Adventurer</div>
          {dates.map((date) => {
            const allAvailable = isAllAvailable(date)
            return (
              <div key={date} className={`date-header ${allAvailable ? 'all-available' : ''}`}>
                <span className="day-of-week">{getDayOfWeek(date)}</span>
                <span className="date-display">{formatDateDisplay(date)}</span>
                <span className="available-count">
                  {countAvailable(date)}/{partyMembers.length}
                </span>
              </div>
            )
          })}
        </div>

        {partyMembers.map((member) => {
          const isCurrentUser = member.profile_id === user?.id
          const canEdit = isAdmin || isCurrentUser

          return (
            <MemberRow
              key={member.id}
              member={member}
              dates={dates}
              isCurrentUser={isCurrentUser}
              canEdit={canEdit}
              getAvailability={getAvailability}
              onToggle={handleToggle}
              isAllAvailable={isAllAvailable}
            />
          )
        })}
      </div>

      <div className="legend">
        <span className="legend-item">
          <span className="legend-dot available" />
          Available
        </span>
        <span className="legend-item">
          <span className="legend-dot unavailable" />
          Unavailable
        </span>
        <span className="legend-item">
          <span className="legend-dot unset" />
          Not set
        </span>
      </div>
    </div>
  )
}

interface MemberRowProps {
  member: PartyMember
  dates: string[]
  isCurrentUser: boolean
  canEdit: boolean
  getAvailability: (memberId: string, date: string) => { available: boolean } | undefined
  onToggle: (memberId: string, date: string) => void
  isAllAvailable: (date: string) => boolean
}

function MemberRow({
  member,
  dates,
  isCurrentUser,
  canEdit,
  getAvailability,
  onToggle,
  isAllAvailable,
}: MemberRowProps) {
  const displayName = member.profiles?.display_name || member.name
  const avatarUrl = member.profiles?.avatar_url
  const isLinked = member.profile_id !== null

  return (
    <div className={`player-row ${isCurrentUser ? 'current-user' : ''} ${!isLinked ? 'unlinked' : ''}`}>
      <div className="player-info">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="avatar"
          />
        ) : (
          <div className="avatar-placeholder">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="player-name">
          {displayName}
          {isCurrentUser && <span className="you-badge">(you)</span>}
          {!isLinked && <span className="pending-badge">pending</span>}
        </span>
      </div>
      {dates.map((date) => {
        const availability = getAvailability(member.id, date)
        const status = availability
          ? availability.available
            ? 'available'
            : 'unavailable'
          : 'unset'
        const allAvailable = isAllAvailable(date)

        return (
          <button
            key={date}
            type="button"
            className={`availability-cell ${status} ${canEdit ? 'clickable' : ''} ${allAvailable ? 'all-available-column' : ''}`}
            onClick={() => canEdit && onToggle(member.id, date)}
            disabled={!canEdit}
            title={
              canEdit
                ? `Click to toggle availability for ${formatDateDisplay(date)}`
                : `${displayName}: ${status}`
            }
          >
            {status === 'available' && '✓'}
            {status === 'unavailable' && '✗'}
            {status === 'unset' && '?'}
          </button>
        )
      })}
    </div>
  )
}
