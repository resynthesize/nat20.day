/**
 * Centralized constants for the application.
 * Consolidates magic numbers and configuration values.
 */

// =============================================================================
// STORAGE KEYS
// =============================================================================

export const STORAGE_KEYS = {
  /** Currently selected party ID */
  CURRENT_PARTY: 'nat20-current-party',
  /** Pending signup data for pre-auth flow */
  PENDING_SIGNUP: 'nat20-pending-signup',
  /** Last known member count for skeleton loading */
  LAST_MEMBER_COUNT: 'nat20-last-member-count',
} as const

// =============================================================================
// CACHE DURATIONS (milliseconds)
// =============================================================================

export const CACHE = {
  /** Standard stale time for Supabase queries (5 minutes) */
  STALE_TIME_DEFAULT: 5 * 60 * 1000,
  /** Extended stale time for infrequently changing data (30 minutes) */
  STALE_TIME_LONG: 30 * 60 * 1000,
  /** Very long stale time for rarely changing data (1 hour) */
  STALE_TIME_VERY_LONG: 60 * 60 * 1000,
  /** Default garbage collection time (30 minutes) */
  GC_TIME_DEFAULT: 30 * 60 * 1000,
  /** Extended garbage collection time (1 hour) */
  GC_TIME_LONG: 60 * 60 * 1000,
  /** Very long garbage collection time (24 hours) */
  GC_TIME_VERY_LONG: 24 * 60 * 60 * 1000,
} as const

// =============================================================================
// UI TIMING (milliseconds)
// =============================================================================

export const UI_TIMING = {
  /** How long toast/banner messages are shown before auto-dismiss */
  TOAST_DURATION: 5000,
  /** How long "Copied!" feedback is shown */
  COPY_FEEDBACK_DURATION: 2000,
  /** Delay before closing modals after action */
  MODAL_CLOSE_DELAY: 150,
} as const

// =============================================================================
// SCHEDULE CONFIGURATION
// =============================================================================

export const SCHEDULE = {
  /** Number of weeks to display in the schedule grid (initial load) */
  WEEKS_TO_DISPLAY: 8,
  /** Number of weeks to fetch per chunk during infinite scroll */
  WEEKS_PER_CHUNK: 4,
  /** Pixels from scroll edge to trigger loading more dates */
  SCROLL_THRESHOLD: 200,
  /** Default days of week for schedule (4 = Thursday, 5 = Friday) */
  DEFAULT_DAYS: [4, 5] as readonly number[],
} as const

// =============================================================================
// API / BILLING
// =============================================================================

export const BILLING = {
  /** Default trial period for free tier (365 days in ms) */
  FREE_TRIAL_DURATION: 365 * 24 * 60 * 60 * 1000,
} as const
