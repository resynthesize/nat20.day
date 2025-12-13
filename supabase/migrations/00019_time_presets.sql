-- Migration: Configurable time presets for session scheduling
-- Allows party admins to define available times and default presets for the scheduler modal

-- =============================================================================
-- ADD TIME PRESET COLUMNS TO PARTIES
-- =============================================================================

-- Available time options that admins have selected (full list)
-- Format: HH:MM in 24-hour format (e.g., '17:00' for 5 PM)
ALTER TABLE parties ADD COLUMN time_options TEXT[] DEFAULT ARRAY['17:00','18:00','19:00','20:00'];

-- Default presets shown in the scheduler modal (max 4)
-- If NULL, uses first 4 from time_options
ALTER TABLE parties ADD COLUMN default_time_presets TEXT[] DEFAULT NULL;

-- =============================================================================
-- ADD CONSTRAINTS
-- =============================================================================

-- Limit total time options (24 hours * 2 for half-hours = 48 max)
ALTER TABLE parties ADD CONSTRAINT time_options_max CHECK (
  time_options IS NULL OR array_length(time_options, 1) <= 48
);

-- Limit default presets to 4 (matches UI button count)
ALTER TABLE parties ADD CONSTRAINT default_time_presets_max CHECK (
  default_time_presets IS NULL OR array_length(default_time_presets, 1) <= 4
);
