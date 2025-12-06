/**
 * PartyDatesList - Shows upcoming dates where all party members are available
 *
 * Features:
 * - Highlights the next party date with a countdown
 * - Expandable to show all upcoming party dates
 * - Uses gold accent to match the grid highlighting
 */

import { useState, useMemo } from 'react'
import { parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns'
import { getDayOfWeek, formatDateDisplay } from '@/lib/dates'

interface PartyDatesListProps {
  dates: string[]
  isAllAvailable: (date: string) => boolean
}

function formatCountdown(dateStr: string): string {
  const date = parseISO(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (isToday(date)) {
    return 'Today!'
  }
  if (isTomorrow(date)) {
    return 'Tomorrow'
  }

  const days = differenceInDays(date, today)
  return `${days} days away`
}

export function PartyDatesList({ dates, isAllAvailable }: PartyDatesListProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const partyDates = useMemo(() => {
    return dates.filter((date) => isAllAvailable(date))
  }, [dates, isAllAvailable])

  if (partyDates.length === 0) {
    return null
  }

  const nextPartyDate = partyDates[0]
  const remainingDates = partyDates.slice(1)

  return (
    <div className="party-dates">
      <div className="party-dates-header">
        <span className="party-dates-icon">🎲</span>
        <span className="party-dates-label">Next Party Date:</span>
        <span className="party-dates-next">
          {getDayOfWeek(nextPartyDate)} {formatDateDisplay(nextPartyDate)}
        </span>
        <span className="party-dates-countdown">({formatCountdown(nextPartyDate)})</span>
      </div>

      {remainingDates.length > 0 && (
        <>
          <button
            type="button"
            className="party-dates-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '▲ Hide' : `▼ ${remainingDates.length} more`}
          </button>

          {isExpanded && (
            <div className="party-dates-list">
              {remainingDates.map((date) => (
                <span key={date} className="party-dates-item">
                  {getDayOfWeek(date)} {formatDateDisplay(date)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
