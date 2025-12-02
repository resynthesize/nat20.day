-- API Tokens for programmatic access
-- Tokens are stored as SHA-256 hashes (raw token never persisted)

CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,  -- First 8 chars for identification in UI
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT api_tokens_name_length CHECK (char_length(name) BETWEEN 1 AND 100)
);

-- Indexes for performance
CREATE INDEX idx_api_tokens_profile_id ON api_tokens(profile_id);
CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);

-- Enable RLS
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage their own tokens
CREATE POLICY "Users can view own tokens"
  ON api_tokens FOR SELECT
  USING (profile_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own tokens"
  ON api_tokens FOR INSERT
  WITH CHECK (profile_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own tokens"
  ON api_tokens FOR DELETE
  USING (profile_id = (SELECT auth.uid()));

-- No UPDATE policy - tokens are immutable (delete and recreate if needed)
