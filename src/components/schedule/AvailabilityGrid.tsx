/**
 * Reusable availability grid component
 * Used by both the main ScheduleGrid (with hooks) and DemoPage (with static data)
 */

import { formatDateDisplay, getDayOfWeek } from '../../lib/dates'

export interface GridMember {
  id: string
  name: string
  avatarUrl?: string | null
  isCurrentUser?: boolean
  isLinked?: boolean
}

export interface GridAvailability {
  memberId: string
  date: string
  available: boolean
}

interface AvailabilityGridProps {
  members: GridMember[]
  dates: string[]
  availability: GridAvailability[]
  onToggle?: (memberId: string, date: string) => void
  canEdit?: (memberId: string) => boolean
  showAdminBadge?: boolean
  readOnly?: boolean
}

export function AvailabilityGrid({
  members,
  dates,
  availability,
  onToggle,
  canEdit,
  showAdminBadge,
  readOnly = false,
}: AvailabilityGridProps) {
  // Build availability lookup map
  const availabilityMap = new Map<string, boolean>()
  for (const a of availability) {
    availabilityMap.set(`${a.memberId}-${a.date}`, a.available)
  }

  const getAvailability = (memberId: string, date: string) => {
    const key = `${memberId}-${date}`
    const value = availabilityMap.get(key)
    return value !== undefined ? { available: value } : undefined
  }

  const countAvailable = (date: string) => {
    return members.filter((m) => availabilityMap.get(`${m.id}-${date}`) === true).length
  }

  const isAllAvailable = (date: string) => {
    return countAvailable(date) === members.length && members.length > 0
  }

  const handleToggle = (memberId: string, date: string) => {
    if (readOnly || !onToggle) return
    if (canEdit && !canEdit(memberId)) return
    onToggle(memberId, date)
  }

  return (
    <div className="schedule-container">
      {showAdminBadge && (
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
                  {countAvailable(date)}/{members.length}
                </span>
              </div>
            )
          })}
        </div>

        {members.map((member) => {
          const memberCanEdit = !readOnly && (canEdit ? canEdit(member.id) : true)

          return (
            <div
              key={member.id}
              className={`player-row ${member.isCurrentUser ? 'current-user' : ''} ${member.isLinked === false ? 'unlinked' : ''}`}
            >
              <div className="player-info">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.name}
                    className="avatar"
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="player-name">
                  {member.name}
                  {member.isCurrentUser && <span className="you-badge">(you)</span>}
                  {member.isLinked === false && <span className="pending-badge">pending</span>}
                </span>
              </div>
              {dates.map((date) => {
                const avail = getAvailability(member.id, date)
                const status = avail
                  ? avail.available
                    ? 'available'
                    : 'unavailable'
                  : 'unset'
                const allAvailable = isAllAvailable(date)

                return (
                  <button
                    key={date}
                    type="button"
                    className={`availability-cell ${status} ${memberCanEdit ? 'clickable' : ''} ${allAvailable ? 'all-available-column' : ''}`}
                    onClick={() => memberCanEdit && handleToggle(member.id, date)}
                    disabled={!memberCanEdit}
                    title={
                      memberCanEdit
                        ? `Click to toggle availability for ${formatDateDisplay(date)}`
                        : `${member.name}: ${status}`
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
