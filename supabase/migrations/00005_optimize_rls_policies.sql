-- Migration: Optimize RLS policies for better performance
-- Wraps auth.uid() calls in subqueries to prevent per-row re-evaluation

-- =============================================================================
-- 1. PROFILES POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id);

-- =============================================================================
-- 2. PARTIES POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their parties" ON parties;
CREATE POLICY "Users can view their parties"
  ON parties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.party_id = parties.id
        AND pm.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Party admins can update party" ON parties;
CREATE POLICY "Party admins can update party"
  ON parties FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = parties.id AND pa.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Party admins can delete party" ON parties;
CREATE POLICY "Party admins can delete party"
  ON parties FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = parties.id AND pa.profile_id = (SELECT auth.uid())
    )
  );

-- =============================================================================
-- 3. PARTY_ADMINS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Members can view party admins" ON party_admins;
CREATE POLICY "Members can view party admins"
  ON party_admins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.party_id = party_admins.party_id
        AND pm.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Party admins can add admins" ON party_admins;
CREATE POLICY "Party admins can add admins"
  ON party_admins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = party_admins.party_id AND pa.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Party admins can remove admins" ON party_admins;
CREATE POLICY "Party admins can remove admins"
  ON party_admins FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = party_admins.party_id AND pa.profile_id = (SELECT auth.uid())
    )
  );

-- =============================================================================
-- 4. PARTY_MEMBERS POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Members can view party members" ON party_members;
CREATE POLICY "Members can view party members"
  ON party_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.party_id = party_members.party_id
        AND pm.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Party admins can insert party members" ON party_members;
CREATE POLICY "Party admins can insert party members"
  ON party_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = party_members.party_id AND pa.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Party admins can update party members" ON party_members;
CREATE POLICY "Party admins can update party members"
  ON party_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = party_members.party_id AND pa.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Party admins can delete party members" ON party_members;
CREATE POLICY "Party admins can delete party members"
  ON party_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = party_members.party_id AND pa.profile_id = (SELECT auth.uid())
    )
  );

-- =============================================================================
-- 5. AVAILABILITY POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can insert their own availability" ON availability;
CREATE POLICY "Users can insert their own availability"
  ON availability FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.id = party_member_id AND pm.profile_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM party_admins pa
      JOIN party_members pm ON pm.party_id = pa.party_id
      WHERE pm.id = party_member_id AND pa.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own availability" ON availability;
CREATE POLICY "Users can update their own availability"
  ON availability FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.id = party_member_id AND pm.profile_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM party_admins pa
      JOIN party_members pm ON pm.party_id = pa.party_id
      WHERE pm.id = party_member_id AND pa.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own availability" ON availability;
CREATE POLICY "Users can delete their own availability"
  ON availability FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.id = party_member_id AND pm.profile_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM party_admins pa
      JOIN party_members pm ON pm.party_id = pa.party_id
      WHERE pm.id = party_member_id AND pa.profile_id = (SELECT auth.uid())
    )
  );
