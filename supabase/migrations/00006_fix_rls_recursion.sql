-- Migration: Fix infinite recursion in RLS policies
-- The party_members SELECT policy was self-referential, causing infinite recursion

-- =============================================================================
-- 1. CREATE HELPER FUNCTION (SECURITY DEFINER bypasses RLS)
-- =============================================================================

-- This function checks party membership without triggering RLS
CREATE OR REPLACE FUNCTION public.user_party_ids(user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT party_id FROM public.party_members WHERE profile_id = user_id
$$;

-- Check if user is admin of a party (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_is_party_admin(user_id UUID, check_party_id UUID)
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

-- =============================================================================
-- 2. FIX PARTY_MEMBERS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Members can view party members" ON party_members;
CREATE POLICY "Members can view party members"
  ON party_members FOR SELECT
  USING (
    party_id IN (SELECT public.user_party_ids((SELECT auth.uid())))
  );

-- =============================================================================
-- 3. FIX PARTIES POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their parties" ON parties;
CREATE POLICY "Users can view their parties"
  ON parties FOR SELECT
  USING (
    id IN (SELECT public.user_party_ids((SELECT auth.uid())))
  );

-- =============================================================================
-- 4. FIX PARTY_ADMINS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Members can view party admins" ON party_admins;
CREATE POLICY "Members can view party admins"
  ON party_admins FOR SELECT
  USING (
    party_id IN (SELECT public.user_party_ids((SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "Party admins can add admins" ON party_admins;
CREATE POLICY "Party admins can add admins"
  ON party_admins FOR INSERT
  WITH CHECK (
    public.user_is_party_admin((SELECT auth.uid()), party_id)
  );

DROP POLICY IF EXISTS "Party admins can remove admins" ON party_admins;
CREATE POLICY "Party admins can remove admins"
  ON party_admins FOR DELETE
  USING (
    public.user_is_party_admin((SELECT auth.uid()), party_id)
  );

-- =============================================================================
-- 5. FIX REMAINING PARTY_MEMBERS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Party admins can insert party members" ON party_members;
CREATE POLICY "Party admins can insert party members"
  ON party_members FOR INSERT
  WITH CHECK (
    public.user_is_party_admin((SELECT auth.uid()), party_id)
  );

DROP POLICY IF EXISTS "Party admins can update party members" ON party_members;
CREATE POLICY "Party admins can update party members"
  ON party_members FOR UPDATE
  USING (
    public.user_is_party_admin((SELECT auth.uid()), party_id)
  );

DROP POLICY IF EXISTS "Party admins can delete party members" ON party_members;
CREATE POLICY "Party admins can delete party members"
  ON party_members FOR DELETE
  USING (
    public.user_is_party_admin((SELECT auth.uid()), party_id)
  );

-- =============================================================================
-- 6. FIX PARTIES ADMIN POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Party admins can update party" ON parties;
CREATE POLICY "Party admins can update party"
  ON parties FOR UPDATE
  USING (
    public.user_is_party_admin((SELECT auth.uid()), id)
  );

DROP POLICY IF EXISTS "Party admins can delete party" ON parties;
CREATE POLICY "Party admins can delete party"
  ON parties FOR DELETE
  USING (
    public.user_is_party_admin((SELECT auth.uid()), id)
  );

-- =============================================================================
-- 7. FIX AVAILABILITY POLICIES
-- =============================================================================

-- Helper to check if user owns a party member or is admin of their party
CREATE OR REPLACE FUNCTION public.user_can_edit_member(user_id UUID, member_id UUID)
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

DROP POLICY IF EXISTS "Users can insert their own availability" ON availability;
CREATE POLICY "Users can insert their own availability"
  ON availability FOR INSERT
  WITH CHECK (
    public.user_can_edit_member((SELECT auth.uid()), party_member_id)
  );

DROP POLICY IF EXISTS "Users can update their own availability" ON availability;
CREATE POLICY "Users can update their own availability"
  ON availability FOR UPDATE
  USING (
    public.user_can_edit_member((SELECT auth.uid()), party_member_id)
  );

DROP POLICY IF EXISTS "Users can delete their own availability" ON availability;
CREATE POLICY "Users can delete their own availability"
  ON availability FOR DELETE
  USING (
    public.user_can_edit_member((SELECT auth.uid()), party_member_id)
  );
