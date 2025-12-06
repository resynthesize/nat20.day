import { useMemo } from 'react'
import { differenceInDays, parseISO, startOfDay } from 'date-fns'
import { formatDateDisplay, getDayOfWeek } from '@/lib/dates'
import { getMapsUrls, isUrl } from '@/lib/maps'
import type { SessionWithHost } from '@/lib/schemas'

interface NextSessionBannerProps {
  session: SessionWithHost
  isAdmin?: boolean
  onEdit?: () => void
}

export function NextSessionBanner({
  session,
  isAdmin = false,
  onEdit,
}: NextSessionBannerProps) {
  // Calculate days until session
  const daysUntil = useMemo(() => {
    const sessionDate = parseISO(session.date)
    const today = startOfDay(new Date())
    return differenceInDays(sessionDate, today)
  }, [session.date])

  // Get host display name
  const hostName = useMemo(() => {
    if (session.host_member) {
      return session.host_member.profiles?.display_name || session.host_member.name
    }
    if (session.host_location) {
      return session.host_location
    }
    return null
  }, [session])

  // Get address info
  const addressInfo = useMemo(() => {
    const address = session.host_address

    if (!address) return null

    if (session.is_virtual || isUrl(address)) {
      return {
        type: 'virtual' as const,
        url: address,
      }
    }

    const mapUrls = getMapsUrls(address)
    if (mapUrls) {
      return {
        type: 'physical' as const,
        address,
        mapUrls,
      }
    }

    return null
  }, [session])

  const countdownText = useMemo(() => {
    if (daysUntil === 0) return 'Today!'
    if (daysUntil === 1) return 'Tomorrow!'
    return `${daysUntil} days away`
  }, [daysUntil])

  return (
    <div className="next-session-banner">
      <div className="next-session-header">
        <span className="next-session-icon">📅</span>
        <div className="next-session-title">
          <span className="next-session-label">Next Session</span>
          <span className="next-session-countdown">{countdownText}</span>
        </div>
        {isAdmin && onEdit && (
          <button
            type="button"
            className="next-session-edit"
            onClick={onEdit}
            title="Edit session"
          >
            Edit
          </button>
        )}
      </div>

      <div className="next-session-date">
        {getDayOfWeek(session.date)}, {formatDateDisplay(session.date)}
      </div>

      {hostName && (
        <div className="next-session-host">
          <span className="next-session-host-label">Hosted by:</span>
          <span className="next-session-host-name">{hostName}</span>
        </div>
      )}

      {addressInfo && (
        <div className="next-session-location">
          {addressInfo.type === 'virtual' ? (
            <a
              href={addressInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="next-session-link"
            >
              Join Meeting &rarr;
            </a>
          ) : (
            <div className="next-session-maps">
              <span className="next-session-address">{addressInfo.address}</span>
              <div className="next-session-map-links">
                <a
                  href={addressInfo.mapUrls.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="next-session-map-link"
                >
                  Google Maps
                </a>
                <a
                  href={addressInfo.mapUrls.apple}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="next-session-map-link"
                >
                  Apple Maps
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
