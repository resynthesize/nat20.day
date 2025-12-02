-- Migration: Billing support for SaaS
-- Adds game_type to parties, demo flag, and subscriptions table

-- ============================================================================
-- Step 1: Add game_type enum and column to parties
-- ============================================================================

CREATE TYPE game_type AS ENUM ('dnd', 'mtg', 'warhammer', 'boardgames', 'other');

ALTER TABLE parties ADD COLUMN game_type game_type NOT NULL DEFAULT 'dnd';

COMMENT ON COLUMN parties.game_type IS 'Type of tabletop game this party plays';

-- ============================================================================
-- Step 2: Add demo flag to parties
-- ============================================================================

ALTER TABLE parties ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN parties.is_demo IS 'Demo parties are read-only and visible to all users';

-- ============================================================================
-- Step 3: Create subscriptions table
-- ============================================================================

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'expired')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_subscriptions_party_id ON subscriptions(party_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

COMMENT ON TABLE subscriptions IS 'Stripe subscription records for party billing';

-- ============================================================================
-- Step 4: Update set_short_id() to handle subscriptions
-- ============================================================================

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

-- ============================================================================
-- Step 5: Create trigger for subscriptions table
-- ============================================================================

CREATE TRIGGER subscriptions_set_id BEFORE INSERT ON subscriptions
  FOR EACH ROW WHEN (NEW.id IS NULL)
  EXECUTE FUNCTION set_short_id();

-- ============================================================================
-- Step 6: Enable RLS on subscriptions
-- ============================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Party admins can view their party's subscription
CREATE POLICY "Party admins can view subscription"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = subscriptions.party_id
        AND pa.profile_id = auth.uid()
    )
  );

-- Only service role can insert/update/delete subscriptions (via webhooks)
-- No policies needed for these operations - they bypass RLS with service role

-- ============================================================================
-- Step 7: Add RLS policy for demo party visibility
-- ============================================================================

-- Allow anyone to view demo parties (existing policy allows members only)
CREATE POLICY "Anyone can view demo parties"
  ON parties FOR SELECT
  USING (is_demo = TRUE);

-- Allow anyone to view demo party members
CREATE POLICY "Anyone can view demo party members"
  ON party_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parties p
      WHERE p.id = party_members.party_id
        AND p.is_demo = TRUE
    )
  );

-- Allow anyone to view demo party availability
CREATE POLICY "Anyone can view demo availability"
  ON availability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      JOIN parties p ON p.id = pm.party_id
      WHERE pm.id = availability.party_member_id
        AND p.is_demo = TRUE
    )
  );

-- ============================================================================
-- Step 8: Helper function to check subscription status
-- ============================================================================

CREATE OR REPLACE FUNCTION get_party_subscription_status(p_party_id TEXT)
RETURNS TABLE (
  is_active BOOLEAN,
  status TEXT,
  expires_at TIMESTAMPTZ,
  is_demo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is a demo party (always "active")
  IF EXISTS (SELECT 1 FROM parties WHERE id = p_party_id AND parties.is_demo = TRUE) THEN
    RETURN QUERY SELECT TRUE, 'demo'::TEXT, NULL::TIMESTAMPTZ, TRUE;
    RETURN;
  END IF;

  -- Check for active subscription
  RETURN QUERY
  SELECT
    s.status IN ('active') AS is_active,
    s.status,
    s.current_period_end AS expires_at,
    FALSE AS is_demo
  FROM subscriptions s
  WHERE s.party_id = p_party_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- If no subscription found, return inactive
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'none'::TEXT, NULL::TIMESTAMPTZ, FALSE;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_party_subscription_status IS 'Check if a party has an active subscription or is a demo party';
