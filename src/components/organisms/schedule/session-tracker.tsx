import { useState, useMemo } from 'react'
import { useSessions } from '@/hooks/useSessions'
import { useParty } from '@/hooks/useParty'
import { useAvailability } from '@/hooks/useAvailability'
import { formatDateDisplay, getDayOfWeek } from '@/lib/dates'
import { getSessionFlavorTextDeterministic } from '@/lib/session-messages'
import { getDisplayName } from '@/lib/display-name'

export function SessionTracker() {
  const { currentParty } = useParty()
  const { partyMembers, availability } = useAvailability({
    partyId: currentParty?.id ?? null,
    daysOfWeek: currentParty?.days_of_week,
  })

  // Transform availability data for useSessions
  const availabilityData = availability.map((a) => ({
    memberId: a.party_member_id,
    date: a.date,
    available: a.available,
  }))

  const {
    daysSinceLastSession,
    suggestedDate,
    confirmSession,
    loading,
  } = useSessions({
    partyId: currentParty?.id ?? null,
    availability: availabilityData,
    memberCount: partyMembers.length,
  })

  const [confirming, setConfirming] = useState(false)

  const handleConfirm = async () => {
    if (!suggestedDate || confirming) return
    setConfirming(true)
    try {
      await confirmSession(suggestedDate)
    } finally {
      setConfirming(false)
    }
  }

  // Don't render if no party selected
  if (!currentParty) return null

  // Don't render while loading
  if (loading) return null

  // Get party member names for flavor text
  const partyMemberNames = useMemo(
    () => partyMembers.map((m) => getDisplayName(m)),
    [partyMembers]
  )

  // Use today's date as seed so message stays consistent for the day
  const today = new Date().toISOString().split('T')[0]
  const flavorText = useMemo(
    () => getSessionFlavorTextDeterministic(daysSinceLastSession, partyMemberNames, today),
    [daysSinceLastSession, partyMemberNames, today]
  )

  const hasPlayed = daysSinceLastSession !== null

  // Only show the tracker if there's something to show:
  // - A past session exists (show days since)
  // - OR a suggested date exists (prompt to confirm)
  if (!hasPlayed && !suggestedDate) return null

  return (
    <div className="session-tracker">
      {hasPlayed && (
        <>
          <div className="session-tracker-header">
            <span className="session-tracker-icon">🎲</span>
            <span className="session-tracker-days">
              {daysSinceLastSession === 0
                ? 'Played today!'
                : daysSinceLastSession === 1
                  ? '1 day since last session'
                  : `${daysSinceLastSession} days since last session`}
            </span>
          </div>
          <p className="session-tracker-flavor">"{flavorText}"</p>
        </>
      )}

      {suggestedDate && (
        <div className={`session-tracker-suggest ${hasPlayed ? '' : 'session-tracker-suggest-only'}`}>
          <span className="session-tracker-suggest-text">
            Did you play on {getDayOfWeek(suggestedDate)}, {formatDateDisplay(suggestedDate)}?
          </span>
          <button
            type="button"
            className="session-tracker-confirm"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? 'Saving...' : 'Yes, we played!'}
          </button>
        </div>
      )}
    </div>
  )
}
