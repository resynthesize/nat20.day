-- Migration: Add party_members table and admin support

-- Create party_members table (source of truth for party roster)
CREATE TABLE IF NOT EXISTS party_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add admin flag to profiles (if not exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Clear existing availability data (we're resetting for the new schema)
TRUNCATE availability;

-- Drop old availability foreign key and add new one
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_user_id_fkey;
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_party_member_id_fkey;

-- Rename column if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'availability' AND column_name = 'user_id') THEN
    ALTER TABLE availability RENAME COLUMN user_id TO party_member_id;
  END IF;
END $$;

ALTER TABLE availability ADD CONSTRAINT availability_party_member_id_fkey
  FOREIGN KEY (party_member_id) REFERENCES party_members(id) ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_availability_user_date;
CREATE INDEX idx_availability_member_date ON availability(party_member_id, date);

-- Enable RLS on party_members
ALTER TABLE party_members ENABLE ROW LEVEL SECURITY;

-- Party members viewable by authenticated users
CREATE POLICY "Party members are viewable by authenticated users"
  ON party_members FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can modify party members
CREATE POLICY "Admins can insert party members"
  ON party_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update party members"
  ON party_members FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete party members"
  ON party_members FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Update availability policies for admin support
DROP POLICY IF EXISTS "Users can insert their own availability" ON availability;
DROP POLICY IF EXISTS "Users can update their own availability" ON availability;
DROP POLICY IF EXISTS "Users can delete their own availability" ON availability;

-- Users can modify their own availability (via linked party_member)
CREATE POLICY "Users can insert their own availability"
  ON availability FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.id = party_member_id AND pm.profile_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Users can update their own availability"
  ON availability FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.id = party_member_id AND pm.profile_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Users can delete their own availability"
  ON availability FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM party_members pm
      WHERE pm.id = party_member_id AND pm.profile_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Seed data should be added via seed.sql (gitignored) or admin UI
-- See supabase/seed.sql.example for format

-- Function to auto-link party member when user signs in (by email match)
CREATE OR REPLACE FUNCTION public.link_party_member()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to link party member by email
  UPDATE public.party_members
  SET profile_id = NEW.id
  WHERE email = NEW.raw_user_meta_data->>'email'
    AND profile_id IS NULL;

  -- Admin assignment handled via seed.sql (not in version control)

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the existing trigger to also link party members
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile (admin assignment handled via seed.sql)
  INSERT INTO public.profiles (id, display_name, avatar_url, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    false
  );

  -- Link party member by email
  UPDATE public.party_members
  SET profile_id = NEW.id
  WHERE email = NEW.raw_user_meta_data->>'email'
    AND profile_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
