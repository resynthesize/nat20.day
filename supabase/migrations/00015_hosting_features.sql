-- Migration: Add hosting features
-- Adds: address to profiles, default host to parties, host info to sessions

-- =============================================================================
-- 1. Add address to profiles (for hosting sessions)
-- =============================================================================
ALTER TABLE profiles ADD COLUMN address TEXT;

COMMENT ON COLUMN profiles.address IS 'Optional address for hosting sessions. Can be physical address or meeting URL.';

-- =============================================================================
-- 2. Add default host settings to parties
-- =============================================================================
ALTER TABLE parties ADD COLUMN default_host_member_id TEXT REFERENCES party_members(id) ON DELETE SET NULL;
ALTER TABLE parties ADD COLUMN default_host_location TEXT;

COMMENT ON COLUMN parties.default_host_member_id IS 'Default host party member. If set, this player hosts by default.';
COMMENT ON COLUMN parties.default_host_location IS 'Default host location name (e.g., "Dice House", "Zoom"). Used when default_host_member_id is NULL.';

-- =============================================================================
-- 3. Add host info to sessions
-- =============================================================================
ALTER TABLE sessions ADD COLUMN host_member_id TEXT REFERENCES party_members(id) ON DELETE SET NULL;
ALTER TABLE sessions ADD COLUMN host_location TEXT;
ALTER TABLE sessions ADD COLUMN host_address TEXT;
ALTER TABLE sessions ADD COLUMN is_virtual BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN sessions.host_member_id IS 'Party member hosting this session. NULL if using a custom location.';
COMMENT ON COLUMN sessions.host_location IS 'Location name if not hosted by a party member (e.g., "Game Store", "Zoom").';
COMMENT ON COLUMN sessions.host_address IS 'Physical address or meeting URL for the session.';
COMMENT ON COLUMN sessions.is_virtual IS 'True if this is a virtual session (Zoom, Discord, etc).';

-- =============================================================================
-- 4. Add update policy for sessions (admins can edit host info)
-- =============================================================================
CREATE POLICY "Admins can update sessions"
  ON sessions FOR UPDATE
  USING (user_is_party_admin(auth.uid(), party_id));
