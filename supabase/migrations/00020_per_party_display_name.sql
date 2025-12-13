-- Migration: Per-party display names
-- Allows users to have different display names in each party they belong to

-- Add nullable display_name column to party_members
-- When NULL, falls back to profiles.display_name, then party_members.name
ALTER TABLE party_members ADD COLUMN display_name TEXT DEFAULT NULL;

-- Note: RLS enforcement is handled at application level
-- - Users can update their own party_members.display_name (where profile_id = auth.uid())
-- - Admins can update any party member's display_name (existing admin policy covers this)
