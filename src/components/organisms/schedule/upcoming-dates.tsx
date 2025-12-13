/**
 * UpcomingDates - Unified view of scheduled sessions and available dates
 *
 * Combines the concepts of "next session" and "party dates" into one list:
 * - Scheduled sessions: confirmed dates with host info, edit capability
 * - Available dates: dates where everyone can play, can be scheduled
 *
 * Sorted chronologically, with clear visual distinction between states.
 */

import { useState, useMemo, useEffect } from 'react'
import { parseISO, differenceInDays, isToday, isTomorrow, startOfDay } from 'date-fns'
import { formatDateDisplay, getDayOfWeek } from '@/lib/dates'
import { getMapsUrls, isUrl } from '@/lib/maps'
import { getHostDisplayName } from '@/lib/display-name'
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
  const today = startOfDay(new Date())

  if (isToday(date)) return 'Today!'
  if (isTomorrow(date)) return 'Tomorrow'

  const days = differenceInDays(date, today)

  if (days < 0) {
    // Past date
    const absDays = Math.abs(days)
    if (absDays === 1) return '1 day ago'
    return `${absDays} days ago`
  }

  return `${days} days away`
}

function isDatePast(dateStr: string): boolean {
  const date = parseISO(dateStr)
  const today = startOfDay(new Date())
  return date < today
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
  const [isUpcomingExpanded, setIsUpcomingExpanded] = useState(false)
  const [isPastExpanded, setIsPastExpanded] = useState(false)
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    date: string
    sessionId?: string
  }>({ isOpen: false, date: '' })

  // Build unified list of dates and split into upcoming/past
  const { upcomingItems, pastItems, nextSessionDate } = useMemo(() => {
    const items: DateItem[] = []
    const addedDates = new Set<string>()

    // Add all available dates from the grid
    for (const date of dates) {
      if (isAllAvailable(date)) {
        const session = sessions.find((s) => s.date === date)
        if (session) {
          // This date is scheduled
          items.push({ date, type: 'scheduled', session })
        } else {
          // This date is available but not scheduled
          items.push({ date, type: 'available' })
        }
        addedDates.add(date)
      } else {
        const session = sessions.find((s) => s.date === date)
        if (session) {
          // Scheduled but not everyone available (edge case)
          items.push({ date, type: 'scheduled', session })
          addedDates.add(date)
        }
      }
    }

    // Also add any sessions not in the current dates array (e.g., past sessions not yet scrolled to)
    for (const session of sessions) {
      if (!addedDates.has(session.date)) {
        items.push({ date: session.date, type: 'scheduled', session })
        addedDates.add(session.date)
      }
    }

    // Sort by date
    items.sort((a, b) => a.date.localeCompare(b.date))

    // Split into upcoming and past
    const upcoming = items.filter((item) => !isDatePast(item.date))
    const past = items.filter((item) => isDatePast(item.date)).reverse() // Most recent first

    // Find the first upcoming scheduled session (next session)
    const nextScheduled = upcoming.find((item) => item.type === 'scheduled')

    return {
      upcomingItems: upcoming,
      pastItems: past,
      nextSessionDate: nextScheduled?.date,
    }
  }, [dates, sessions, isAllAvailable])

  // Detect mobile viewport for responsive initial count
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 768
  )

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // How many to show initially (fewer on mobile to save space)
  const INITIAL_UPCOMING_COUNT = isMobile ? 2 : 4
  const INITIAL_PAST_COUNT = isMobile ? 2 : 3
  const visibleUpcoming = isUpcomingExpanded ? upcomingItems : upcomingItems.slice(0, INITIAL_UPCOMING_COUNT)
  const visiblePast = isPastExpanded ? pastItems : pastItems.slice(0, INITIAL_PAST_COUNT)
  const hiddenUpcomingCount = upcomingItems.length - INITIAL_UPCOMING_COUNT
  const hiddenPastCount = pastItems.length - INITIAL_PAST_COUNT

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

  // Render a single date item
  const renderDateItem = (item: DateItem, isPast: boolean = false) => {
    const isNextSession = !isPast && item.date === nextSessionDate && item.type === 'scheduled'
    const hostName = getHostDisplayName(item.session?.host_member)
      || item.session?.host_location
      || null
    const address = item.session?.host_address
    const isVirtual = item.session?.is_virtual
    const mapsUrls = address && !isVirtual ? getMapsUrls(address) : null
    const startTime = formatTime(item.session?.start_time)

    return (
      <div
        key={item.date}
        className={`upcoming-date-item ${item.type} ${isNextSession ? 'next-session' : ''} ${isPast ? 'past' : ''}`}
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

          {isAdmin && !isPast && (
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
              {/* Map links for physical addresses - hide on past dates */}
              {!isPast && mapsUrls && (
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
              {/* Virtual meeting link - hide on past dates */}
              {!isPast && isVirtual && address && isUrl(address) && (
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
              <span className="upcoming-date-label">
                {isPast ? 'Was available' : "Everyone's free"}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (upcomingItems.length === 0 && pastItems.length === 0) {
    return null
  }

  return (
    <div className="upcoming-dates">
      {/* Upcoming Sessions Section */}
      {upcomingItems.length > 0 && (
        <>
          <h3 className="upcoming-dates-title">Upcoming Dates</h3>
          <div className="upcoming-dates-list">
            {visibleUpcoming.map((item) => renderDateItem(item, false))}
          </div>

          {hiddenUpcomingCount > 0 && (
            <button
              type="button"
              className="upcoming-dates-toggle"
              onClick={() => setIsUpcomingExpanded(!isUpcomingExpanded)}
            >
              {isUpcomingExpanded ? '▲ Show less' : `▼ ${hiddenUpcomingCount} more dates`}
            </button>
          )}
        </>
      )}

      {/* Past Sessions Section */}
      {pastItems.length > 0 && (
        <div className="past-dates-section">
          <button
            type="button"
            className="past-dates-header"
            onClick={() => setIsPastExpanded(!isPastExpanded)}
          >
            <h3 className="past-dates-title">Past Sessions</h3>
            <span className="past-dates-count">{pastItems.length}</span>
            <span className="past-dates-arrow">{isPastExpanded ? '▲' : '▼'}</span>
          </button>

          {isPastExpanded && (
            <>
              <div className="upcoming-dates-list past-dates-list">
                {visiblePast.map((item) => renderDateItem(item, true))}
              </div>

              {hiddenPastCount > 0 && (
                <button
                  type="button"
                  className="upcoming-dates-toggle"
                  onClick={() => setIsPastExpanded(!isPastExpanded)}
                >
                  ▲ Show less
                </button>
              )}
            </>
          )}
        </div>
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
