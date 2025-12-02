-- Migration: Fix short IDs migration (cleanup from partial 00008 failure)
-- This completes the transition to short text IDs

-- =============================================================================
-- STEP 1: DROP ALL DEPENDENT POLICIES
-- =============================================================================

-- Drop availability policies
DROP POLICY IF EXISTS "Availability is viewable by authenticated users" ON availability;
DROP POLICY IF EXISTS "Users can delete their own availability" ON availability;
DROP POLICY IF EXISTS "Users can insert their own availability" ON availability;
DROP POLICY IF EXISTS "Users can update their own availability" ON availability;

-- Drop party_members policies
DROP POLICY IF EXISTS "Members can view party members" ON party_members;
DROP POLICY IF EXISTS "Party admins can delete party members" ON party_members;
DROP POLICY IF EXISTS "Party admins can insert party members" ON party_members;
DROP POLICY IF EXISTS "Party admins can update party members" ON party_members;

-- Drop party_admins policies
DROP POLICY IF EXISTS "Members can view party admins" ON party_admins;
DROP POLICY IF EXISTS "Party admins can add admins" ON party_admins;
DROP POLICY IF EXISTS "Party admins can remove admins" ON party_admins;

-- Drop parties policies
DROP POLICY IF EXISTS "Authenticated users can create parties" ON parties;
DROP POLICY IF EXISTS "Party admins can delete party" ON parties;
DROP POLICY IF EXISTS "Party admins can update party" ON parties;
DROP POLICY IF EXISTS "Users can view their parties" ON parties;

-- =============================================================================
-- STEP 2: DROP HELPER FUNCTIONS
-- =============================================================================

DROP FUNCTION IF EXISTS user_party_ids(UUID);
DROP FUNCTION IF EXISTS user_is_party_admin(UUID, UUID);
DROP FUNCTION IF EXISTS user_can_edit_member(UUID, UUID);

-- =============================================================================
-- STEP 3: DROP OLD FOREIGN KEYS AND CONSTRAINTS
-- =============================================================================

ALTER TABLE party_members DROP CONSTRAINT IF EXISTS party_members_party_id_fkey;
ALTER TABLE party_admins DROP CONSTRAINT IF EXISTS party_admins_party_id_fkey;
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_party_member_id_fkey;
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_member_date_unique;
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_user_id_date_key;

-- Drop unique indexes that reference old columns
DROP INDEX IF EXISTS idx_party_members_party_email;
DROP INDEX IF EXISTS idx_party_members_party_id;
DROP INDEX IF EXISTS idx_availability_date;

-- =============================================================================
-- STEP 4: DROP OLD PRIMARY KEYS
-- =============================================================================

ALTER TABLE party_admins DROP CONSTRAINT IF EXISTS party_admins_pkey;
ALTER TABLE parties DROP CONSTRAINT IF EXISTS parties_pkey;

-- =============================================================================
-- STEP 5: DROP OLD COLUMNS AND RENAME NEW ONES
-- =============================================================================

-- parties: drop old UUID id, rename new_id to id
ALTER TABLE parties DROP COLUMN id CASCADE;
ALTER TABLE parties RENAME COLUMN new_id TO id;
ALTER TABLE parties ADD PRIMARY KEY (id);

-- party_members: drop old UUID party_id, rename new_party_id to party_id
ALTER TABLE party_members DROP COLUMN party_id CASCADE;
ALTER TABLE party_members RENAME COLUMN new_party_id TO party_id;
ALTER TABLE party_members ALTER COLUMN party_id SET NOT NULL;

-- party_admins: drop old UUID party_id, rename new_party_id to party_id
ALTER TABLE party_admins DROP COLUMN party_id CASCADE;
ALTER TABLE party_admins RENAME COLUMN new_party_id TO party_id;
ALTER TABLE party_admins ALTER COLUMN party_id SET NOT NULL;
ALTER TABLE party_admins ADD PRIMARY KEY (party_id, profile_id);

-- availability: drop old UUID party_member_id, rename new_party_member_id
ALTER TABLE availability DROP COLUMN party_member_id CASCADE;
ALTER TABLE availability RENAME COLUMN new_party_member_id TO party_member_id;
ALTER TABLE availability ALTER COLUMN party_member_id SET NOT NULL;

-- =============================================================================
-- STEP 6: ADD NEW FOREIGN KEYS
-- =============================================================================

ALTER TABLE party_members ADD CONSTRAINT party_members_party_id_fkey
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

ALTER TABLE party_admins ADD CONSTRAINT party_admins_party_id_fkey
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

ALTER TABLE availability ADD CONSTRAINT availability_party_member_id_fkey
  FOREIGN KEY (party_member_id) REFERENCES party_members(id) ON DELETE CASCADE;

-- =============================================================================
-- STEP 7: ADD NEW CONSTRAINTS AND INDEXES
-- =============================================================================

ALTER TABLE availability ADD CONSTRAINT availability_member_date_unique
  UNIQUE (party_member_id, date);

CREATE INDEX idx_party_members_party_id ON party_members(party_id);
CREATE INDEX idx_party_members_party_email ON party_members(party_id, email) WHERE email IS NOT NULL;
CREATE INDEX idx_availability_date ON availability(date);

-- =============================================================================
-- STEP 8: CREATE NEW HELPER FUNCTIONS (with TEXT types)
-- =============================================================================

-- Get party IDs for a user (returns TEXT now)
CREATE OR REPLACE FUNCTION public.user_party_ids(user_id UUID)
RETURNS SETOF TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT party_id FROM public.party_members WHERE profile_id = user_id
$$;

-- Check if user is admin of a party (party_id is now TEXT)
CREATE OR REPLACE FUNCTION public.user_is_party_admin(user_id UUID, check_party_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.party_admins
    WHERE profile_id = user_id AND party_id = check_party_id
  )
$$;

-- Check if user can edit a party member (member_id is now TEXT)
CREATE OR REPLACE FUNCTION public.user_can_edit_member(user_id UUID, member_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    -- User owns this party member
    SELECT 1 FROM public.party_members
    WHERE id = member_id AND profile_id = user_id
  ) OR EXISTS (
    -- User is admin of the party this member belongs to
    SELECT 1 FROM public.party_members pm
    JOIN public.party_admins pa ON pa.party_id = pm.party_id
    WHERE pm.id = member_id AND pa.profile_id = user_id
  )
$$;

-- =============================================================================
-- STEP 9: RECREATE RLS POLICIES
-- =============================================================================

-- parties policies
CREATE POLICY "Authenticated users can create parties"
  ON parties FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view their parties"
  ON parties FOR SELECT
  USING (id IN (SELECT public.user_party_ids((SELECT auth.uid()))));

CREATE POLICY "Party admins can update party"
  ON parties FOR UPDATE
  USING (public.user_is_party_admin((SELECT auth.uid()), id));

CREATE POLICY "Party admins can delete party"
  ON parties FOR DELETE
  USING (public.user_is_party_admin((SELECT auth.uid()), id));

-- party_members policies
CREATE POLICY "Members can view party members"
  ON party_members FOR SELECT
  USING (party_id IN (SELECT public.user_party_ids((SELECT auth.uid()))));

CREATE POLICY "Party admins can insert party members"
  ON party_members FOR INSERT
  WITH CHECK (public.user_is_party_admin((SELECT auth.uid()), party_id));

CREATE POLICY "Party admins can update party members"
  ON party_members FOR UPDATE
  USING (public.user_is_party_admin((SELECT auth.uid()), party_id));

CREATE POLICY "Party admins can delete party members"
  ON party_members FOR DELETE
  USING (public.user_is_party_admin((SELECT auth.uid()), party_id));

-- party_admins policies
CREATE POLICY "Members can view party admins"
  ON party_admins FOR SELECT
  USING (party_id IN (SELECT public.user_party_ids((SELECT auth.uid()))));

CREATE POLICY "Party admins can add admins"
  ON party_admins FOR INSERT
  WITH CHECK (public.user_is_party_admin((SELECT auth.uid()), party_id));

CREATE POLICY "Party admins can remove admins"
  ON party_admins FOR DELETE
  USING (public.user_is_party_admin((SELECT auth.uid()), party_id));

-- availability policies
CREATE POLICY "Availability is viewable by authenticated users"
  ON availability FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own availability"
  ON availability FOR INSERT
  WITH CHECK (public.user_can_edit_member((SELECT auth.uid()), party_member_id));

CREATE POLICY "Users can update their own availability"
  ON availability FOR UPDATE
  USING (public.user_can_edit_member((SELECT auth.uid()), party_member_id));

CREATE POLICY "Users can delete their own availability"
  ON availability FOR DELETE
  USING (public.user_can_edit_member((SELECT auth.uid()), party_member_id));
