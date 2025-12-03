-- Migration: Pending signups for pre-auth signup flow
-- Stores party details and payment state before user creates account

-- ============================================================================
-- Step 1: Create pending_signups table
-- ============================================================================

CREATE TABLE pending_signups (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  party_name TEXT NOT NULL,
  game_type game_type NOT NULL DEFAULT 'dnd',
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  payment_completed BOOLEAN NOT NULL DEFAULT FALSE,
  profile_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Indexes for common lookups
CREATE INDEX idx_pending_signups_email ON pending_signups(email);
CREATE INDEX idx_pending_signups_stripe_subscription ON pending_signups(stripe_subscription_id);
CREATE INDEX idx_pending_signups_expires_at ON pending_signups(expires_at);

COMMENT ON TABLE pending_signups IS 'Temporary storage for signups before account creation';
COMMENT ON COLUMN pending_signups.payment_completed IS 'Set to true by webhook when invoice.paid fires';
COMMENT ON COLUMN pending_signups.profile_id IS 'Set when signup is completed and linked to user account';
COMMENT ON COLUMN pending_signups.expires_at IS 'Pending signups expire after 24 hours if not completed';

-- ============================================================================
-- Step 2: Update set_short_id() to handle pending_signups
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
    WHEN 'pending_signups' THEN prefix := 'signup';
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
-- Step 3: Create trigger for pending_signups table
-- ============================================================================

CREATE TRIGGER pending_signups_set_id BEFORE INSERT ON pending_signups
  FOR EACH ROW WHEN (NEW.id IS NULL)
  EXECUTE FUNCTION set_short_id();

-- ============================================================================
-- Step 4: RLS policies (service role only for writes)
-- ============================================================================

ALTER TABLE pending_signups ENABLE ROW LEVEL SECURITY;

-- No RLS policies for authenticated users - all operations use service role
-- The pending_signups table is only accessed by:
-- 1. API endpoints using service role (signup/start, signup/complete)
-- 2. Stripe webhook using service role
