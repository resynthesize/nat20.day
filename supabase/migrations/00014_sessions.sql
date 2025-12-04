-- Migration: Session tracking
-- Tracks when parties actually played, with auto-suggest for dates where all were available

-- =============================================================================
-- 1. CREATE SESSIONS TABLE
-- =============================================================================

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  confirmed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(party_id, date)
);

COMMENT ON TABLE sessions IS 'Confirmed game sessions for each party';
COMMENT ON COLUMN sessions.confirmed_by IS 'Profile ID of member who confirmed the session happened';

-- =============================================================================
-- 2. INDEXES
-- =============================================================================

CREATE INDEX idx_sessions_party_id ON sessions(party_id);
CREATE INDEX idx_sessions_party_date ON sessions(party_id, date DESC);

-- =============================================================================
-- 3. SHORT ID TRIGGER
-- =============================================================================

-- Update the set_short_id function to handle sessions table
CREATE OR REPLACE FUNCTION set_short_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prefix TEXT;
  new_id TEXT;
  retries INT := 0;
BEGIN
  -- Determine prefix based on table
  CASE TG_TABLE_NAME
    WHEN 'parties' THEN prefix := 'party';
    WHEN 'party_members' THEN prefix := 'adv';
    WHEN 'availability' THEN prefix := 'avail';
    WHEN 'api_tokens' THEN prefix := 'tok';
    WHEN 'subscriptions' THEN prefix := 'sub';
    WHEN 'sessions' THEN prefix := 'sess';
    ELSE prefix := 'id';
  END CASE;

  -- Generate ID with collision retry
  LOOP
    new_id := generate_short_id(prefix);
    BEGIN
      NEW.id := new_id;
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      retries := retries + 1;
      IF retries > 3 THEN
        RAISE EXCEPTION 'Could not generate unique ID after 3 retries';
      END IF;
    END;
  END LOOP;
END;
$$;

CREATE TRIGGER sessions_set_id BEFORE INSERT ON sessions
  FOR EACH ROW WHEN (NEW.id IS NULL)
  EXECUTE FUNCTION set_short_id();

-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Party members can view their party's sessions
CREATE POLICY "Members can view party sessions"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.party_id = sessions.party_id
        AND pm.profile_id = auth.uid()
    )
  );

-- Any party member can confirm a session (insert)
CREATE POLICY "Members can confirm sessions"
  ON sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.party_id = party_id
        AND pm.profile_id = auth.uid()
    )
  );

-- Only party admins can delete sessions (undo mistakes)
CREATE POLICY "Admins can delete sessions"
  ON sessions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = sessions.party_id
        AND pa.profile_id = auth.uid()
    )
  );

-- Demo party sessions are viewable by anyone
CREATE POLICY "Anyone can view demo party sessions"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parties p
      WHERE p.id = sessions.party_id
        AND p.is_demo = TRUE
    )
  );

-- =============================================================================
-- 5. ENABLE REALTIME
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
