/**
 * Skeleton loading state for ScheduleGrid
 *
 * Shows a simple block shimmer that approximates the grid size without
 * revealing the underlying structure. Uses localStorage to remember
 * the last member count for more accurate height estimation.
 */

import { SkeletonBox } from '../ui/skeleton'
import { STORAGE_KEYS } from '../../lib/constants'

const STORAGE_KEY = STORAGE_KEYS.LAST_MEMBER_COUNT
const DEFAULT_MEMBER_COUNT = 6

// Approximate row heights from schedule.css
const HEADER_HEIGHT = 60
const ROW_HEIGHT = 40
const LEGEND_HEIGHT = 48

function getEstimatedHeight(): number {
  let memberCount = DEFAULT_MEMBER_COUNT

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const count = parseInt(stored, 10)
      if (!isNaN(count) && count > 0 && count <= 20) {
        memberCount = count
      }
    }
  } catch {
    // localStorage may not be available
  }

  return HEADER_HEIGHT + memberCount * ROW_HEIGHT + LEGEND_HEIGHT
}

export function ScheduleGridSkeleton() {
  const height = getEstimatedHeight()

  return (
    <div className="schedule-container">
      <SkeletonBox
        width="100%"
        height={height}
        style={{ borderRadius: 'var(--radius-md)' }}
      />
    </div>
  )
}
