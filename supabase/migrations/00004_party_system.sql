-- Migration: Multi-party system
-- Introduces parties, party-specific admin roles, and multi-party membership

-- =============================================================================
-- 1. CREATE NEW TABLES
-- =============================================================================

-- Parties table
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Party admins join table (many-to-many: parties <-> profiles)
CREATE TABLE party_admins (
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (party_id, profile_id)
);

-- =============================================================================
-- 2. ALTER PARTY_MEMBERS TABLE
-- =============================================================================

-- Add party_id column (nullable initially for migration)
ALTER TABLE party_members ADD COLUMN party_id UUID REFERENCES parties(id) ON DELETE CASCADE;

-- =============================================================================
-- 3. MIGRATE EXISTING DATA
-- =============================================================================

DO $$
DECLARE
  v_party_id UUID;
  v_admin_profile_id UUID;
BEGIN
  -- Create "Third Thursdays" party
  INSERT INTO parties (name) VALUES ('Third Thursdays') RETURNING id INTO v_party_id;

  -- Link all existing party members to this party
  UPDATE party_members SET party_id = v_party_id;

  -- Find Brandon's profile_id via party_members email link
  SELECT pm.profile_id INTO v_admin_profile_id
  FROM party_members pm
  WHERE pm.email = 'btallent@gmail.com'
    AND pm.profile_id IS NOT NULL;

  -- If Brandon's profile exists, make him admin of the party
  IF v_admin_profile_id IS NOT NULL THEN
    INSERT INTO party_admins (party_id, profile_id)
    VALUES (v_party_id, v_admin_profile_id);
  END IF;
END $$;

-- =============================================================================
-- 4. FINALIZE SCHEMA CHANGES
-- =============================================================================

-- Make party_id NOT NULL now that all rows have values
ALTER TABLE party_members ALTER COLUMN party_id SET NOT NULL;

-- Drop old unique constraint on email (was globally unique)
ALTER TABLE party_members DROP CONSTRAINT IF EXISTS party_members_email_key;

-- Add new unique constraint: email must be unique per party (not globally)
CREATE UNIQUE INDEX idx_party_members_party_email
  ON party_members(party_id, email)
  WHERE email IS NOT NULL;

-- Add index for party lookups
CREATE INDEX idx_party_members_party_id ON party_members(party_id);
CREATE INDEX idx_party_admins_profile_id ON party_admins(profile_id);

-- Drop is_admin from profiles (now party-specific via party_admins)
ALTER TABLE profiles DROP COLUMN IF EXISTS is_admin;

-- =============================================================================
-- 5. ENABLE RLS ON NEW TABLES
-- =============================================================================

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_admins ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. RLS POLICIES FOR PARTIES
-- =============================================================================

-- Users can view parties they belong to (via party_members with their profile_id)
CREATE POLICY "Users can view their parties"
  ON parties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.party_id = parties.id
        AND pm.profile_id = auth.uid()
    )
  );

-- Authenticated users can create parties
CREATE POLICY "Authenticated users can create parties"
  ON parties FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only party admins can update their party
CREATE POLICY "Party admins can update party"
  ON parties FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = parties.id AND pa.profile_id = auth.uid()
    )
  );

-- Only party admins can delete their party
CREATE POLICY "Party admins can delete party"
  ON parties FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = parties.id AND pa.profile_id = auth.uid()
    )
  );

-- =============================================================================
-- 7. RLS POLICIES FOR PARTY_ADMINS
-- =============================================================================

-- Users can view admins of parties they belong to
CREATE POLICY "Members can view party admins"
  ON party_admins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.party_id = party_admins.party_id
        AND pm.profile_id = auth.uid()
    )
  );

-- Party admins can add other admins
CREATE POLICY "Party admins can add admins"
  ON party_admins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = party_id AND pa.profile_id = auth.uid()
    )
  );

-- Party admins can remove admins (but app logic prevents removing last admin)
CREATE POLICY "Party admins can remove admins"
  ON party_admins FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = party_admins.party_id AND pa.profile_id = auth.uid()
    )
  );

-- =============================================================================
-- 8. UPDATE RLS POLICIES FOR PARTY_MEMBERS
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Party members are viewable by authenticated users" ON party_members;
DROP POLICY IF EXISTS "Admins can insert party members" ON party_members;
DROP POLICY IF EXISTS "Admins can update party members" ON party_members;
DROP POLICY IF EXISTS "Admins can delete party members" ON party_members;

-- Users can view members of parties they belong to
CREATE POLICY "Members can view party members"
  ON party_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.party_id = party_members.party_id
        AND pm.profile_id = auth.uid()
    )
  );

-- Party admins can add members to their party
CREATE POLICY "Party admins can insert party members"
  ON party_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = party_id AND pa.profile_id = auth.uid()
    )
  );

-- Party admins can update members in their party
CREATE POLICY "Party admins can update party members"
  ON party_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = party_members.party_id AND pa.profile_id = auth.uid()
    )
  );

-- Party admins can delete members from their party
CREATE POLICY "Party admins can delete party members"
  ON party_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = party_members.party_id AND pa.profile_id = auth.uid()
    )
  );

-- =============================================================================
-- 9. UPDATE RLS POLICIES FOR AVAILABILITY
-- =============================================================================

-- Drop existing availability policies
DROP POLICY IF EXISTS "Users can insert their own availability" ON availability;
DROP POLICY IF EXISTS "Users can update their own availability" ON availability;
DROP POLICY IF EXISTS "Users can delete their own availability" ON availability;

-- Users can modify their own availability OR admins can modify any in their party
CREATE POLICY "Users can insert their own availability"
  ON availability FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.id = party_member_id AND pm.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM party_admins pa
      JOIN party_members pm ON pm.party_id = pa.party_id
      WHERE pm.id = party_member_id AND pa.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own availability"
  ON availability FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.id = party_member_id AND pm.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM party_admins pa
      JOIN party_members pm ON pm.party_id = pa.party_id
      WHERE pm.id = party_member_id AND pa.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own availability"
  ON availability FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.id = party_member_id AND pm.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM party_admins pa
      JOIN party_members pm ON pm.party_id = pa.party_id
      WHERE pm.id = party_member_id AND pa.profile_id = auth.uid()
    )
  );

-- =============================================================================
-- 10. UPDATE TRIGGER FUNCTION
-- =============================================================================

-- Update handle_new_user to not reference is_admin (removed column)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Link party member by email (across all parties)
  UPDATE public.party_members
  SET profile_id = NEW.id
  WHERE email = NEW.raw_user_meta_data->>'email'
    AND profile_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 11. ENABLE REALTIME FOR NEW TABLES
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE parties;
ALTER PUBLICATION supabase_realtime ADD TABLE party_admins;
