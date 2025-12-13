/**
 * Reusable availability grid component
 * Used by both the main ScheduleGrid (with hooks) and DemoPage (with static data)
 */

import { memo, useMemo, useCallback, type RefObject } from 'react'
import { formatDateDisplay, getDayOfWeek } from '@/lib/dates'

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

export interface ScheduledSession {
  date: string
  sessionId: string
  hostName?: string | null
}

interface AvailabilityGridProps {
  members: GridMember[]
  dates: string[]
  availability: GridAvailability[]
  onToggle?: (memberId: string, date: string) => void
  canEdit?: (memberId: string) => boolean
  readOnly?: boolean
  scheduledSessions?: ScheduledSession[]
  // Infinite scroll props
  containerRef?: RefObject<HTMLDivElement | null>
  isLoadingPast?: boolean
  isLoadingFuture?: boolean
}

function AvailabilityGridComponent({
  members,
  dates,
  availability,
  onToggle,
  canEdit,
  readOnly = false,
  scheduledSessions = [],
  containerRef,
  isLoadingPast = false,
  isLoadingFuture = false,
}: AvailabilityGridProps) {
  // Memoize the availability lookup map - only rebuilds when availability changes
  const availabilityMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const a of availability) {
      map.set(`${a.memberId}-${a.date}`, a.available)
    }
    return map
  }, [availability])

  // Memoize scheduled dates lookup - maps date to host info
  const scheduledMap = useMemo(() => {
    const map = new Map<string, ScheduledSession>()
    for (const session of scheduledSessions) {
      map.set(session.date, session)
    }
    return map
  }, [scheduledSessions])

  const isScheduled = useCallback(
    (date: string) => scheduledMap.has(date),
    [scheduledMap]
  )

  const getScheduledInfo = useCallback(
    (date: string) => scheduledMap.get(date),
    [scheduledMap]
  )

  const getAvailability = useCallback(
    (memberId: string, date: string) => {
      const key = `${memberId}-${date}`
      const value = availabilityMap.get(key)
      return value !== undefined ? { available: value } : undefined
    },
    [availabilityMap]
  )

  // Memoize count calculations - these are O(N) and called for each date header
  const availabilityCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const date of dates) {
      const count = members.filter((m) => availabilityMap.get(`${m.id}-${date}`) === true).length
      counts.set(date, count)
    }
    return counts
  }, [dates, members, availabilityMap])

  const countAvailable = useCallback(
    (date: string) => availabilityCounts.get(date) ?? 0,
    [availabilityCounts]
  )

  const isAllAvailable = useCallback(
    (date: string) => countAvailable(date) === members.length && members.length > 0,
    [countAvailable, members.length]
  )

  const handleToggle = useCallback(
    (memberId: string, date: string) => {
      if (readOnly || !onToggle) return
      if (canEdit && !canEdit(memberId)) return
      onToggle(memberId, date)
    },
    [readOnly, onToggle, canEdit]
  )

  return (
    <div className="schedule-container">
      <div className="schedule-wrapper">
        {/* Fixed names column */}
        <div className="schedule-names">
          <div className="player-label">Adventurer</div>
          {members.map((member) => (
            <div
              key={member.id}
              className={`player-info ${member.isCurrentUser ? 'current-user' : ''} ${member.isLinked === false ? 'unlinked' : ''}`}
            >
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
          ))}
        </div>

        {/* Scrollable dates grid */}
        <div className="schedule-dates" ref={containerRef}>
          {isLoadingPast && (
            <div className="scroll-loader scroll-loader-left">
              <span className="loader-spinner" />
            </div>
          )}
          <div
            className="schedule-grid"
            style={{ '--date-columns': dates.length } as React.CSSProperties}
          >
            <div className="grid-header">
              {dates.map((date) => {
                const allAvailable = isAllAvailable(date)
                const scheduled = isScheduled(date)
                const scheduledInfo = getScheduledInfo(date)
                const hostTooltip = scheduledInfo?.hostName
                  ? `Scheduled - Host: ${scheduledInfo.hostName}`
                  : 'Scheduled'
                return (
                  <div
                    key={date}
                    className={`date-header ${allAvailable ? 'all-available' : ''} ${scheduled ? 'scheduled' : ''}`}
                    title={scheduled ? hostTooltip : undefined}
                  >
                    <span className="day-of-week">{getDayOfWeek(date)}</span>
                    <span className="date-display">{formatDateDisplay(date)}</span>
                    <span className="available-count">
                      {countAvailable(date)}/{members.length}
                      <span className="party-icon">🎲</span>
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
                  {dates.map((date) => {
                    const avail = getAvailability(member.id, date)
                    const status = avail
                      ? avail.available
                        ? 'available'
                        : 'unavailable'
                      : 'unset'
                    const allAvailable = isAllAvailable(date)
                    const scheduled = isScheduled(date)

                    return (
                      <button
                        key={date}
                        type="button"
                        className={`availability-cell ${status} ${memberCanEdit ? 'clickable' : ''} ${allAvailable ? 'all-available-column' : ''} ${scheduled ? 'scheduled-column' : ''}`}
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
          {isLoadingFuture && (
            <div className="scroll-loader scroll-loader-right">
              <span className="loader-spinner" />
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

// Memoize the entire component - prevents re-renders when parent state changes
// but grid props remain the same (shallow comparison)
export const AvailabilityGrid = memo(AvailabilityGridComponent)
