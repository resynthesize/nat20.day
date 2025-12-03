-- Add theme support to parties
-- Allows each party to have a distinct visual theme

ALTER TABLE parties
  ADD COLUMN theme TEXT NOT NULL DEFAULT 'dnd'
  CONSTRAINT valid_theme CHECK (theme IN ('dnd', 'mtg', 'vtm'));

COMMENT ON COLUMN parties.theme IS 'Visual theme for the party: dnd (Dungeons & Dragons), mtg (Magic: The Gathering), vtm (Vampire: The Masquerade)';
