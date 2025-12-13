-- Migration: Add start_time to sessions
-- Allows scheduling sessions with a specific time

-- =============================================================================
-- 1. ADD START_TIME COLUMN
-- =============================================================================

ALTER TABLE sessions ADD COLUMN start_time TIME DEFAULT NULL;

-- =============================================================================
-- 2. ADD COMMENT FOR DOCUMENTATION
-- =============================================================================

COMMENT ON COLUMN sessions.start_time IS 'Optional start time for the session (local time, no timezone)';
