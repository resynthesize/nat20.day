/**
 * Skeleton loading state for ScheduleGrid
 *
 * Matches the exact structure and dimensions of AvailabilityGrid to prevent
 * layout shift during loading. Reads last known member count from localStorage
 * for a more accurate skeleton that matches the expected content size.
 */

import { SkeletonBox, SkeletonCircle, SkeletonText } from '../ui/skeleton'

const STORAGE_KEY = 'nat20-last-member-count'
const DEFAULT_MEMBER_COUNT = 6
const DEFAULT_DATE_COUNT = 16 // 8 weeks of Thu/Fri

function getLastMemberCount(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const count = parseInt(stored, 10)
      if (!isNaN(count) && count > 0 && count <= 20) {
        return count
      }
    }
  } catch {
    // localStorage may not be available
  }
  return DEFAULT_MEMBER_COUNT
}

interface ScheduleGridSkeletonProps {
  memberCount?: number
  dateCount?: number
}

export function ScheduleGridSkeleton({
  memberCount,
  dateCount = DEFAULT_DATE_COUNT,
}: ScheduleGridSkeletonProps) {
  const rowCount = memberCount ?? getLastMemberCount()

  return (
    <div className="schedule-container">
      <div
        className="schedule-grid"
        style={{ '--date-columns': dateCount } as React.CSSProperties}
      >
        {/* Header row */}
        <div className="grid-header">
          <div className="player-label">
            <SkeletonText width="70%" />
          </div>
          {Array.from({ length: dateCount }).map((_, i) => (
            <div key={i} className="date-header">
              <span className="day-of-week">
                <SkeletonText width="80%" />
              </span>
              <span className="date-display">
                <SkeletonText width="90%" />
              </span>
              <span className="available-count">
                <SkeletonText width="50%" />
              </span>
            </div>
          ))}
        </div>

        {/* Member rows */}
        {Array.from({ length: rowCount }).map((_, rowIndex) => (
          <div key={rowIndex} className="player-row">
            <div className="player-info">
              <SkeletonCircle size={24} />
              <span className="player-name">
                <SkeletonText width={80 + (rowIndex % 3) * 20} />
              </span>
            </div>
            {Array.from({ length: dateCount }).map((_, cellIndex) => (
              <div key={cellIndex} className="availability-cell unset">
                <SkeletonBox width={16} height={16} style={{ borderRadius: 2 }} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="legend">
        <span className="legend-item">
          <SkeletonBox width={10} height={10} style={{ borderRadius: 2 }} />
          <SkeletonText width={55} />
        </span>
        <span className="legend-item">
          <SkeletonBox width={10} height={10} style={{ borderRadius: 2 }} />
          <SkeletonText width={70} />
        </span>
        <span className="legend-item">
          <SkeletonBox width={10} height={10} style={{ borderRadius: 2 }} />
          <SkeletonText width={45} />
        </span>
      </div>
    </div>
  )
}
