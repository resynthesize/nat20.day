/**
 * UpcomingDates - Unified view of scheduled sessions and available dates
 *
 * Combines the concepts of "next session" and "party dates" into one list:
 * - Scheduled sessions: confirmed dates with host info, edit capability
 * - Available dates: dates where everyone can play, can be scheduled
 *
 * Sorted chronologically, with clear visual distinction between states.
 */

import { useState, useMemo } from 'react'
import { parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns'
import { formatDateDisplay, getDayOfWeek } from '@/lib/dates'
import { getMapsUrls, isUrl } from '@/lib/maps'
import { ScheduleSessionModal } from './schedule-session-modal'
import type { SessionWithHost, PartyMember, PartyWithAdmins } from '@/lib/schemas'

interface UpcomingDatesProps {
  /** All dates shown in the grid */
  dates: string[]
  /** Function to check if all members are available on a date */
  isAllAvailable: (date: string) => boolean
  /** Scheduled sessions */
  sessions: SessionWithHost[]
  /** Is the current user an admin? */
  isAdmin: boolean
  /** Party members for the schedule modal */
  partyMembers: PartyMember[]
  /** Current party for the schedule modal */
  party: PartyWithAdmins | null
  /** Called when scheduling a new session */
  onSchedule: (options: {
    date: string
    hostMemberId?: string | null
    hostLocation?: string | null
    hostAddress?: string | null
    isVirtual?: boolean
    startTime?: string | null
  }) => Promise<void>
  /** Called when updating an existing session */
  onUpdate: (sessionId: string, options: {
    hostMemberId?: string | null
    hostLocation?: string | null
    hostAddress?: string | null
    isVirtual?: boolean
    startTime?: string | null
  }) => Promise<void>
  /** Called when canceling a session */
  onCancel: (sessionId: string) => Promise<void>
}

interface DateItem {
  date: string
  type: 'scheduled' | 'available'
  session?: SessionWithHost
}

function formatCountdown(dateStr: string): string {
  const date = parseISO(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (isToday(date)) return 'Today!'
  if (isTomorrow(date)) return 'Tomorrow'

  const days = differenceInDays(date, today)
  return `${days} days away`
}

function formatTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null
  // Parse HH:MM or HH:MM:SS format and convert to 12-hour time
  const [hours, minutes] = timeStr.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`
}

export function UpcomingDates({
  dates,
  isAllAvailable,
  sessions,
  isAdmin,
  partyMembers,
  party,
  onSchedule,
  onUpdate,
  onCancel,
}: UpcomingDatesProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    date: string
    sessionId?: string
  }>({ isOpen: false, date: '' })

  // Build unified list of dates
  const dateItems = useMemo(() => {
    const items: DateItem[] = []
    const sessionDates = new Set(sessions.map((s) => s.date))

    // Add all available dates
    for (const date of dates) {
      if (isAllAvailable(date)) {
        if (sessionDates.has(date)) {
          // This date is scheduled
          const session = sessions.find((s) => s.date === date)!
          items.push({ date, type: 'scheduled', session })
        } else {
          // This date is available but not scheduled
          items.push({ date, type: 'available' })
        }
      } else if (sessionDates.has(date)) {
        // Scheduled but not everyone available (edge case)
        const session = sessions.find((s) => s.date === date)!
        items.push({ date, type: 'scheduled', session })
      }
    }

    // Sort by date
    items.sort((a, b) => a.date.localeCompare(b.date))

    return items
  }, [dates, sessions, isAllAvailable])

  // Find the first scheduled session (next session)
  const nextSessionDate = useMemo(() => {
    const scheduled = dateItems.find((item) => item.type === 'scheduled')
    return scheduled?.date
  }, [dateItems])

  // How many to show initially
  const INITIAL_COUNT = 4
  const visibleItems = isExpanded ? dateItems : dateItems.slice(0, INITIAL_COUNT)
  const hiddenCount = dateItems.length - INITIAL_COUNT

  const handleScheduleClick = (date: string) => {
    setModalState({ isOpen: true, date })
  }

  const handleEditClick = (date: string, sessionId: string) => {
    setModalState({ isOpen: true, date, sessionId })
  }

  const handleModalClose = () => {
    setModalState({ isOpen: false, date: '' })
  }

  const handleModalConfirm = async (options: {
    hostMemberId?: string | null
    hostLocation?: string | null
    hostAddress?: string | null
    isVirtual?: boolean
    startTime?: string | null
  }) => {
    if (modalState.sessionId) {
      await onUpdate(modalState.sessionId, options)
    } else {
      await onSchedule({ date: modalState.date, ...options })
    }
  }

  if (dateItems.length === 0) {
    return null
  }

  return (
    <div className="upcoming-dates">
      <h3 className="upcoming-dates-title">Upcoming Dates</h3>

      <div className="upcoming-dates-list">
        {visibleItems.map((item) => {
          const isNextSession = item.date === nextSessionDate && item.type === 'scheduled'
          const hostName = item.session?.host_member?.profiles?.display_name
            || item.session?.host_location
            || null
          const address = item.session?.host_address
          const isVirtual = item.session?.is_virtual
          const mapsUrls = address && !isVirtual ? getMapsUrls(address) : null
          const startTime = formatTime(item.session?.start_time)

          return (
            <div
              key={item.date}
              className={`upcoming-date-item ${item.type} ${isNextSession ? 'next-session' : ''}`}
            >
              <div className="upcoming-date-header">
                <div className="upcoming-date-info">
                  <span className="upcoming-date-day">
                    {getDayOfWeek(item.date)}, {formatDateDisplay(item.date)}
                    {startTime && <span className="upcoming-date-time"> at {startTime}</span>}
                  </span>
                  <span className="upcoming-date-countdown">
                    {formatCountdown(item.date)}
                  </span>
                  {isNextSession && (
                    <span className="upcoming-date-badge">Next Session</span>
                  )}
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    className={`upcoming-date-action ${item.type}`}
                    onClick={() =>
                      item.type === 'scheduled'
                        ? handleEditClick(item.date, item.session!.id)
                        : handleScheduleClick(item.date)
                    }
                  >
                    {item.type === 'scheduled' ? 'Edit' : '📅 Schedule'}
                  </button>
                )}
              </div>

              <div className="upcoming-date-status">
                {item.type === 'scheduled' ? (
                  <>
                    <div className="upcoming-date-status-row">
                      <span className="upcoming-date-icon">📅</span>
                      <span className="upcoming-date-label">
                        {hostName ? `Hosted by ${hostName}` : 'Scheduled'}
                      </span>
                    </div>
                    {/* Map links for physical addresses */}
                    {mapsUrls && (
                      <div className="upcoming-date-maps">
                        <a href={mapsUrls.google} target="_blank" rel="noopener noreferrer">
                          Google Maps
                        </a>
                        <span className="upcoming-date-maps-divider">·</span>
                        <a href={mapsUrls.apple} target="_blank" rel="noopener noreferrer">
                          Apple Maps
                        </a>
                      </div>
                    )}
                    {/* Virtual meeting link */}
                    {isVirtual && address && isUrl(address) && (
                      <div className="upcoming-date-maps">
                        <a
                          href={address}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="upcoming-date-link"
                        >
                          Join Meeting →
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="upcoming-date-status-row">
                    <span className="upcoming-date-icon">🎲</span>
                    <span className="upcoming-date-label">Everyone's free</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          className="upcoming-dates-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▲ Show less' : `▼ ${hiddenCount} more dates`}
        </button>
      )}

      {/* Schedule/Edit Modal */}
      <ScheduleSessionModal
        isOpen={modalState.isOpen}
        onClose={handleModalClose}
        date={modalState.date}
        partyMembers={partyMembers}
        party={party}
        onConfirm={handleModalConfirm}
        sessionId={modalState.sessionId}
        existingSession={modalState.sessionId ? sessions.find(s => s.id === modalState.sessionId) : null}
        onCancel={onCancel}
      />
    </div>
  )
}
