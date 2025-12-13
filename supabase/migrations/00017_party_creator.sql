-- Migration: Track party creator for delete permissions
-- Only the party creator (tied to billing) should be able to delete the party

-- =============================================================================
-- 1. ADD CREATED_BY COLUMN
-- =============================================================================

ALTER TABLE parties ADD COLUMN created_by UUID REFERENCES profiles(id);

-- Index for looking up parties by creator
CREATE INDEX idx_parties_created_by ON parties(created_by);

-- =============================================================================
-- 2. BACKFILL EXISTING PARTIES
-- =============================================================================

-- Set created_by to the first admin added to each party (by created_at)
UPDATE parties p
SET created_by = (
  SELECT pa.profile_id
  FROM party_admins pa
  WHERE pa.party_id = p.id
  ORDER BY pa.created_at ASC
  LIMIT 1
)
WHERE p.created_by IS NULL;

-- =============================================================================
-- 3. UPDATE SOFT DELETE FUNCTION
-- =============================================================================

-- Only the party creator can soft delete (not just any admin)
CREATE OR REPLACE FUNCTION soft_delete_party(p_party_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE parties
  SET deleted_at = NOW()
  WHERE id = p_party_id
    AND deleted_at IS NULL
    AND created_by = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only the party creator can restore (for consistency)
CREATE OR REPLACE FUNCTION restore_party(p_party_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE parties
  SET deleted_at = NULL
  WHERE id = p_party_id
    AND deleted_at IS NOT NULL
    AND created_by = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
