-- Migration: Soft delete for parties
-- Adds deleted_at column and updates RLS policies to exclude deleted parties

-- =============================================================================
-- 1. ADD DELETED_AT COLUMN
-- =============================================================================

ALTER TABLE parties ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient filtering of non-deleted parties
CREATE INDEX idx_parties_deleted_at ON parties(deleted_at) WHERE deleted_at IS NULL;

-- =============================================================================
-- 2. UPDATE RLS POLICIES FOR PARTIES
-- =============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their parties" ON parties;

-- Users can view non-deleted parties they belong to
CREATE POLICY "Users can view their parties"
  ON parties FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.party_id = parties.id
        AND pm.profile_id = auth.uid()
    )
  );

-- =============================================================================
-- 3. CREATE HELPER FUNCTION FOR SOFT DELETE
-- =============================================================================

-- Function to soft delete a party (sets deleted_at timestamp)
CREATE OR REPLACE FUNCTION soft_delete_party(p_party_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE parties
  SET deleted_at = NOW()
  WHERE id = p_party_id
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = p_party_id
        AND pa.profile_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a soft-deleted party (for future undo feature)
CREATE OR REPLACE FUNCTION restore_party(p_party_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE parties
  SET deleted_at = NULL
  WHERE id = p_party_id
    AND deleted_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM party_admins pa
      WHERE pa.party_id = p_party_id
        AND pa.profile_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION soft_delete_party(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_party(UUID) TO authenticated;
