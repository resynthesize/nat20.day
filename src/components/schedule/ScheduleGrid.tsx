import { useAuth } from '../../hooks/useAuth'
import { useAvailability } from '../../hooks/useAvailability'
import { formatDateDisplay, getDayOfWeek } from '../../lib/dates'
import { Profile } from '../../lib/supabase'

export function ScheduleGrid() {
  const { user } = useAuth()
  const {
    dates,
    profiles,
    loading,
    error,
    getAvailability,
    setAvailability,
    countAvailable,
  } = useAvailability()

  if (loading) {
    return <div className="loading">Loading schedule...</div>
  }

  if (error) {
    return <div className="error">Error: {error}</div>
  }

  const handleToggle = (userId: string, date: string) => {
    if (userId !== user?.id) return // Can only toggle own availability

    const current = getAvailability(userId, date)
    const newValue = current ? !current.available : true
    setAvailability(userId, date, newValue)
  }

  return (
    <div className="schedule-container">
      <div className="schedule-grid">
        {/* Header row with dates */}
        <div className="grid-header">
          <div className="player-label">Adventurer</div>
          {dates.map((date) => (
            <div key={date} className="date-header">
              <span className="day-of-week">{getDayOfWeek(date)}</span>
              <span className="date-display">{formatDateDisplay(date)}</span>
              <span className="available-count">
                {countAvailable(date)}/{profiles.length}
              </span>
            </div>
          ))}
        </div>

        {/* Player rows */}
        {profiles.map((profile) => (
          <PlayerRow
            key={profile.id}
            profile={profile}
            dates={dates}
            isCurrentUser={profile.id === user?.id}
            getAvailability={getAvailability}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {/* Legend */}
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

interface PlayerRowProps {
  profile: Profile
  dates: string[]
  isCurrentUser: boolean
  getAvailability: (userId: string, date: string) => { available: boolean } | undefined
  onToggle: (userId: string, date: string) => void
}

function PlayerRow({
  profile,
  dates,
  isCurrentUser,
  getAvailability,
  onToggle,
}: PlayerRowProps) {
  return (
    <div className={`player-row ${isCurrentUser ? 'current-user' : ''}`}>
      <div className="player-info">
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt={profile.display_name}
            className="avatar"
          />
        )}
        <span className="player-name">
          {profile.display_name}
          {isCurrentUser && <span className="you-badge">(you)</span>}
        </span>
      </div>
      {dates.map((date) => {
        const availability = getAvailability(profile.id, date)
        const status = availability
          ? availability.available
            ? 'available'
            : 'unavailable'
          : 'unset'

        return (
          <button
            key={date}
            className={`availability-cell ${status} ${isCurrentUser ? 'clickable' : ''}`}
            onClick={() => isCurrentUser && onToggle(profile.id, date)}
            disabled={!isCurrentUser}
            title={
              isCurrentUser
                ? `Click to toggle availability for ${formatDateDisplay(date)}`
                : `${profile.display_name}: ${status}`
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
