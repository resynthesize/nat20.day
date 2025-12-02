-- Demo Party Seed Data
-- This creates a public demo party for users to explore before signing up
-- Run this after applying migrations to populate the demo data

-- Create the demo party with a known ID
INSERT INTO parties (id, name, game_type, is_demo, created_at)
VALUES (
  'party_DEMO0000',
  'The Tavern Regulars',
  'dnd',
  true,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  game_type = EXCLUDED.game_type,
  is_demo = EXCLUDED.is_demo;

-- Create demo party members (no profile_id - these are fictional characters)
INSERT INTO party_members (id, party_id, name, email, profile_id, created_at)
VALUES
  ('adv_DEMO0001', 'party_DEMO0000', 'Thorin Ironforge', NULL, NULL, NOW()),
  ('adv_DEMO0002', 'party_DEMO0000', 'Elara Moonwhisper', NULL, NULL, NOW()),
  ('adv_DEMO0003', 'party_DEMO0000', 'Grimlock the Bold', NULL, NULL, NOW()),
  ('adv_DEMO0004', 'party_DEMO0000', 'Zara Shadowstep', NULL, NULL, NOW()),
  ('adv_DEMO0005', 'party_DEMO0000', 'Aldric Lightbringer', NULL, NULL, NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

-- Generate availability data for the next 8 weeks
-- This creates a realistic pattern where some days work and some don't
DO $$
DECLARE
  member_ids TEXT[] := ARRAY['adv_DEMO0001', 'adv_DEMO0002', 'adv_DEMO0003', 'adv_DEMO0004', 'adv_DEMO0005'];
  member_id TEXT;
  target_date DATE;
  day_of_week INT;
  i INT;
BEGIN
  -- Delete existing demo availability
  DELETE FROM availability WHERE party_member_id LIKE 'adv_DEMO%';

  -- Generate availability for the next 8 weeks
  FOR i IN 0..55 LOOP
    target_date := CURRENT_DATE + i;
    day_of_week := EXTRACT(DOW FROM target_date);

    -- Only generate for Thursdays (4) and Fridays (5)
    IF day_of_week IN (4, 5) THEN
      FOREACH member_id IN ARRAY member_ids LOOP
        -- Create varied but realistic availability patterns
        -- Each member has different probability of being available
        INSERT INTO availability (party_member_id, date, available, updated_at)
        VALUES (
          member_id,
          target_date,
          CASE
            -- Thorin: Usually available (80%)
            WHEN member_id = 'adv_DEMO0001' THEN random() < 0.8
            -- Elara: Often available (70%)
            WHEN member_id = 'adv_DEMO0002' THEN random() < 0.7
            -- Grimlock: Hit or miss (50%)
            WHEN member_id = 'adv_DEMO0003' THEN random() < 0.5
            -- Zara: Busy schedule (40%)
            WHEN member_id = 'adv_DEMO0004' THEN random() < 0.4
            -- Aldric: Pretty reliable (75%)
            WHEN member_id = 'adv_DEMO0005' THEN random() < 0.75
            ELSE random() < 0.5
          END,
          NOW()
        )
        ON CONFLICT (party_member_id, date) DO UPDATE SET
          available = EXCLUDED.available,
          updated_at = NOW();
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Output summary
SELECT
  'Demo party created with ' || COUNT(DISTINCT pm.id) || ' members and ' ||
  COUNT(a.id) || ' availability records' AS summary
FROM party_members pm
LEFT JOIN availability a ON a.party_member_id = pm.id
WHERE pm.party_id = 'party_DEMO0000';
