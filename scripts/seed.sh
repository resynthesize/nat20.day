#!/bin/bash
# Applies seed data to Supabase database
# Reads config from .env.local and infra/terraform.tfvars

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Get project ID from .env.local (extract from VITE_SUPABASE_URL)
if [ -z "$SUPABASE_PROJECT_ID" ]; then
  SUPABASE_URL=$(grep "VITE_SUPABASE_URL" "$PROJECT_ROOT/.env.local" 2>/dev/null | cut -d'"' -f2 || echo "")
  if [ -n "$SUPABASE_URL" ]; then
    # Extract project ID from URL like https://xxx.supabase.co
    SUPABASE_PROJECT_ID=$(echo "$SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co|\1|')
  fi
fi

# Get access token from terraform.tfvars
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  SUPABASE_ACCESS_TOKEN=$(grep -E "^supabase_access_token" "$PROJECT_ROOT/infra/terraform.tfvars" 2>/dev/null | cut -d'"' -f2 || echo "")
fi

if [ -z "$SUPABASE_PROJECT_ID" ] || [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "Error: Could not determine SUPABASE_PROJECT_ID or SUPABASE_ACCESS_TOKEN"
  echo "Ensure .env.local has VITE_SUPABASE_URL and infra/terraform.tfvars has supabase_access_token"
  exit 1
fi

SEED_FILE="$PROJECT_ROOT/supabase/seed.sql"

if [ ! -f "$SEED_FILE" ]; then
  echo "Error: seed.sql not found at $SEED_FILE"
  echo "Copy supabase/seed.sql.example to supabase/seed.sql and fill in your data"
  exit 1
fi

echo "Applying seed data to project $SUPABASE_PROJECT_ID..."

SQL=$(cat "$SEED_FILE")

RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL" | jq -Rs .)}")

if echo "$RESPONSE" | grep -q '"message"'; then
  echo "Error: $RESPONSE"
  exit 1
fi

echo "Seed data applied successfully!"
