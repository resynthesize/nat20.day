-- Migration: Short, fun IDs for all resources
-- Format: prefix_XXXXXXXX (8 chars of base62)
-- Examples: party_Kj7mNp3x, adv_Qx3rYz8w, avail_Abc12345

-- Step 1: Create base62 ID generation function
CREATE OR REPLACE FUNCTION generate_short_id(prefix TEXT, length INT DEFAULT 8)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * 62 + 1)::int, 1);
  END LOOP;
  RETURN prefix || '_' || result;
END;
$$;

-- Step 2: Add slug to profiles (must keep UUID PK due to auth.users reference)
ALTER TABLE profiles ADD COLUMN slug TEXT;
UPDATE profiles SET slug = generate_short_id('user');
ALTER TABLE profiles ALTER COLUMN slug SET NOT NULL;
ALTER TABLE profiles ADD CONSTRAINT profiles_slug_unique UNIQUE (slug);

-- Step 3: Migrate parties to short IDs
-- 3a. Add new ID column
ALTER TABLE parties ADD COLUMN new_id TEXT;
UPDATE parties SET new_id = generate_short_id('party');
ALTER TABLE parties ALTER COLUMN new_id SET NOT NULL;
ALTER TABLE parties ADD CONSTRAINT parties_new_id_unique UNIQUE (new_id);

-- 3b. Add new columns to referencing tables
ALTER TABLE party_members ADD COLUMN new_party_id TEXT;
ALTER TABLE party_admins ADD COLUMN new_party_id TEXT;

-- 3c. Populate new foreign key columns
UPDATE party_members pm SET new_party_id = p.new_id FROM parties p WHERE pm.party_id = p.id;
UPDATE party_admins pa SET new_party_id = p.new_id FROM parties p WHERE pa.party_id = p.id;

-- Step 4: Migrate party_members to short IDs
ALTER TABLE party_members ADD COLUMN new_id TEXT;
UPDATE party_members SET new_id = generate_short_id('adv');
ALTER TABLE party_members ALTER COLUMN new_id SET NOT NULL;
ALTER TABLE party_members ADD CONSTRAINT party_members_new_id_unique UNIQUE (new_id);

-- 4b. Add new column to availability
ALTER TABLE availability ADD COLUMN new_party_member_id TEXT;
UPDATE availability a SET new_party_member_id = pm.new_id FROM party_members pm WHERE a.party_member_id = pm.id;

-- Step 5: Migrate availability to short IDs
ALTER TABLE availability ADD COLUMN new_id TEXT;
UPDATE availability SET new_id = generate_short_id('avail');
ALTER TABLE availability ALTER COLUMN new_id SET NOT NULL;
ALTER TABLE availability ADD CONSTRAINT availability_new_id_unique UNIQUE (new_id);

-- Step 6: Migrate api_tokens to short IDs
ALTER TABLE api_tokens ADD COLUMN new_id TEXT;
UPDATE api_tokens SET new_id = generate_short_id('tok');
ALTER TABLE api_tokens ALTER COLUMN new_id SET NOT NULL;
ALTER TABLE api_tokens ADD CONSTRAINT api_tokens_new_id_unique UNIQUE (new_id);

-- Step 7: Drop old constraints and columns, rename new ones

-- 7a. Drop old foreign key constraints
ALTER TABLE party_members DROP CONSTRAINT IF EXISTS party_members_party_id_fkey;
ALTER TABLE party_admins DROP CONSTRAINT IF EXISTS party_admins_party_id_fkey;
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_party_member_id_fkey;

-- 7b. Drop old primary keys
ALTER TABLE availability DROP CONSTRAINT availability_pkey;
ALTER TABLE api_tokens DROP CONSTRAINT api_tokens_pkey;
ALTER TABLE party_members DROP CONSTRAINT party_members_pkey;
ALTER TABLE party_admins DROP CONSTRAINT party_admins_pkey;
ALTER TABLE parties DROP CONSTRAINT parties_pkey;

-- 7c. Drop old ID columns
ALTER TABLE availability DROP COLUMN id;
ALTER TABLE availability DROP COLUMN party_member_id;
ALTER TABLE api_tokens DROP COLUMN id;
ALTER TABLE party_members DROP COLUMN id;
ALTER TABLE party_members DROP COLUMN party_id;
ALTER TABLE party_admins DROP COLUMN party_id;
ALTER TABLE parties DROP COLUMN id;

-- 7d. Rename new columns
ALTER TABLE parties RENAME COLUMN new_id TO id;
ALTER TABLE party_members RENAME COLUMN new_id TO id;
ALTER TABLE party_members RENAME COLUMN new_party_id TO party_id;
ALTER TABLE party_admins RENAME COLUMN new_party_id TO party_id;
ALTER TABLE availability RENAME COLUMN new_id TO id;
ALTER TABLE availability RENAME COLUMN new_party_member_id TO party_member_id;
ALTER TABLE api_tokens RENAME COLUMN new_id TO id;

-- 7e. Add new primary keys
ALTER TABLE parties ADD PRIMARY KEY (id);
ALTER TABLE party_members ADD PRIMARY KEY (id);
ALTER TABLE party_admins ADD PRIMARY KEY (party_id, profile_id);
ALTER TABLE availability ADD PRIMARY KEY (id);
ALTER TABLE api_tokens ADD PRIMARY KEY (id);

-- 7f. Add new foreign key constraints
ALTER TABLE party_members ADD CONSTRAINT party_members_party_id_fkey
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;
ALTER TABLE party_admins ADD CONSTRAINT party_admins_party_id_fkey
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;
ALTER TABLE availability ADD CONSTRAINT availability_party_member_id_fkey
  FOREIGN KEY (party_member_id) REFERENCES party_members(id) ON DELETE CASCADE;

-- 7g. Recreate unique constraints that were dropped
ALTER TABLE availability ADD CONSTRAINT availability_member_date_unique
  UNIQUE (party_member_id, date);

-- 7h. Drop old unique constraints and recreate indexes
DROP INDEX IF EXISTS idx_api_tokens_profile_id;
CREATE INDEX idx_api_tokens_profile_id ON api_tokens(profile_id);

DROP INDEX IF EXISTS idx_availability_member_date;
CREATE INDEX idx_availability_member_date ON availability(party_member_id, date);

-- Step 8: Create trigger function for auto-generating IDs on insert
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

-- Step 9: Create triggers for each table
CREATE TRIGGER parties_set_id BEFORE INSERT ON parties
  FOR EACH ROW WHEN (NEW.id IS NULL)
  EXECUTE FUNCTION set_short_id();

CREATE TRIGGER party_members_set_id BEFORE INSERT ON party_members
  FOR EACH ROW WHEN (NEW.id IS NULL)
  EXECUTE FUNCTION set_short_id();

CREATE TRIGGER availability_set_id BEFORE INSERT ON availability
  FOR EACH ROW WHEN (NEW.id IS NULL)
  EXECUTE FUNCTION set_short_id();

CREATE TRIGGER api_tokens_set_id BEFORE INSERT ON api_tokens
  FOR EACH ROW WHEN (NEW.id IS NULL)
  EXECUTE FUNCTION set_short_id();

-- Step 10: Create trigger for profile slugs
CREATE OR REPLACE FUNCTION set_profile_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := generate_short_id('user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_slug BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_profile_slug();

-- Update the handle_new_user function to not set slug (trigger handles it)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Adventurer'),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Auto-link any party members with matching email
  UPDATE public.party_members
  SET profile_id = NEW.id
  WHERE email = NEW.email AND profile_id IS NULL;

  RETURN NEW;
END;
$$;
