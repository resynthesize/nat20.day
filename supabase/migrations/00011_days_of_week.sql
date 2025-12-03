-- Migration: Configurable days of week for party scheduling
-- Allows party admins to choose which days appear in the availability grid

-- Add days_of_week column with default of Friday (5) and Saturday (6)
ALTER TABLE parties
  ADD COLUMN days_of_week INTEGER[] NOT NULL DEFAULT ARRAY[5,6];

-- Add constraint to ensure:
-- 1. At least 1 day is selected
-- 2. At most 7 days are selected
-- 3. All values are valid day numbers (0=Sunday through 6=Saturday)
ALTER TABLE parties
  ADD CONSTRAINT days_of_week_valid
  CHECK (
    array_length(days_of_week, 1) >= 1 AND
    array_length(days_of_week, 1) <= 7 AND
    days_of_week <@ ARRAY[0,1,2,3,4,5,6]
  );

COMMENT ON COLUMN parties.days_of_week IS 'Days of week to show in schedule grid (0=Sunday, 6=Saturday)';
