# AGENTS.md - AI Agent Guidelines for NAT 20

## Project Overview

**NAT 20** is a D&D session scheduler for coordinating party availability. Users authenticate via Google OAuth, toggle their availability for Thursday/Friday dates, and view the entire party's schedule in a real-time grid.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Vercel serverless functions (Node.js) |
| Database | Supabase (PostgreSQL) with Row-Level Security |
| Validation | Zod schemas |
| Error Handling | Effect library (API layer) |
| Date Utils | date-fns |
| Infrastructure | Terraform (Vercel, Cloudflare, Supabase) |
| Testing | Vitest, React Testing Library |

## Directory Structure

```
src/                      # React frontend
├── components/           # UI components (auth/, schedule/, ui/)
├── hooks/                # Custom hooks (useAuth, useAvailability)
├── lib/                  # Utilities (dates, schemas, supabase client)
└── test/                 # Test setup

api/                      # Vercel serverless functions
├── _lib/                 # Shared utilities
│   ├── stripe/           # All Stripe code (webhooks, operations, schemas)
│   ├── billing/          # Billing handlers (uses stripe/)
│   ├── handlers/         # API endpoint handlers
│   └── helpers.ts        # Shared helpers
├── stripe-webhook.ts     # Stripe webhook entry point
└── health.ts             # Health check

supabase/
├── migrations/           # SQL migrations (numbered)
└── config.toml           # Local Supabase config

infra/                    # Terraform IaC
```

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component, auth UI, schedule grid container |
| `src/hooks/useAuth.ts` | Authentication state, Google OAuth, profile loading |
| `src/hooks/useAvailability.ts` | Availability state, real-time subscriptions, mutations |
| `src/lib/dates.ts` | Date generation (8 weeks of Thu/Fri only) |
| `src/lib/schemas.ts` | Zod validation schemas for frontend |
| `src/components/schedule/ScheduleGrid.tsx` | Main availability grid component |
| `api/availability/index.ts` | GET endpoint for schedule data |
| `api/lib/supabase.ts` | Effect-based Supabase service |
| `supabase/migrations/*.sql` | Database schema definitions |

## Database Schema

**Tables:**
- `profiles` - User profiles (extends auth.users), includes `is_admin` flag
- `party_members` - Roster of adventurers, linked to profiles by email
- `availability` - Availability records (party_member_id, date, available)

**Key constraints:**
- Unique constraint on `(party_member_id, date)` in availability
- RLS policies restrict users to their own data (admins can edit all)

## Architectural Patterns

### Frontend
- **Custom hooks** encapsulate state and side effects
- **Real-time subscriptions** via Supabase channels
- **Optimistic UI** - update locally before server confirmation

### Backend API
- **Effect library** for functional error handling
- **Service pattern** - `SupabaseService` as managed dependency
- **Custom error types**: `AuthError`, `DatabaseError`, `ValidationError`, `ConfigError`

### Data Flow
1. Auth: Google OAuth → Supabase session → auto-create profile → auto-link party member
2. Availability: Fetch on mount → subscribe to changes → toggle triggers upsert → real-time update

## Development Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
npm run lint         # ESLint check
```

## Environment Variables

Required in `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # Server-side only
```

## Sensitive Data & PII

**Never commit PII (names, emails, etc.) to the repository.** Use the `.example` pattern:

| File | Purpose | Gitignored? |
|------|---------|-------------|
| `supabase/seed.sql.example` | Template with placeholder data | No (committed) |
| `supabase/seed.sql` | Actual seed with real names/emails | Yes |
| `infra/terraform.tfvars.example` | Template for Terraform vars | No (committed) |
| `infra/terraform.tfvars` | Actual secrets and config | Yes |
| `.env.local.example` | Template for env vars | No (committed) |
| `.env.local` | Actual API keys | Yes |

**Rules for migrations:**
- Migrations (`supabase/migrations/*.sql`) contain only schema DDL (CREATE TABLE, ALTER, etc.)
- Never include INSERT statements with real user data in migrations
- Seed data with real names/emails goes in `supabase/seed.sql` (gitignored)

**When adding new config:**
1. Create a `.example` version with placeholder values
2. Add the real file to `.gitignore`
3. Document in README if needed

## Deployment

### Vercel (Frontend + API)

Deployment is automatic via GitHub integration:
- **Push to `main`** → auto-deploys to production
- **Push to other branches** → creates preview deployment

Manual deployment (if needed):
```bash
vercel              # Preview deployment
vercel --prod       # Production deployment
```

### Environment Variables (Vercel)

Set in Vercel Dashboard → Project Settings → Environment Variables:
- `VITE_SUPABASE_URL` - Set by Terraform
- `VITE_SUPABASE_ANON_KEY` - Add manually after Supabase setup
- `SUPABASE_SERVICE_ROLE_KEY` - Add manually (server-side only)

### Database Migrations

Migrations are **not** auto-applied. Run via REST API (recommended) or CLI:

**Option 1: REST API (works with Claude Code)**
```bash
PROJECT_ID="nptmqjpjlemfyivgoxkq"
TOKEN=`grep -E "^supabase_access_token" infra/terraform.tfvars | cut -d'"' -f2`
SQL=`cat supabase/migrations/00015_example.sql`

curl -s -X POST "https://api.supabase.com/v1/projects/$PROJECT_ID/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL" | jq -Rs .)}"
```

**Option 2: Supabase CLI** (requires TTY for interactive login)
```bash
supabase db push    # Apply migrations to remote
```

### Seeding Data

After migrations, seed party member data:
```bash
npm run db:seed     # Runs scripts/seed.sh
```

This reads from `supabase/seed.sql` (gitignored) and applies via Supabase API.

### Infrastructure (Terraform)

Terraform manages Vercel project, Cloudflare DNS, and Supabase project:
```bash
cd infra
terraform init      # First time setup
terraform plan      # Preview changes
terraform apply     # Apply changes
```

**Note:** Some config (Google OAuth, API keys) must be set manually in respective dashboards after `terraform apply`.

## CLI Tokens

CLI tokens are stored in `infra/terraform.tfvars` and exported via `~/.zshrc`:

```bash
# In ~/.zshrc - automatically loads tokens from tfvars
_nat20_tfvars="$HOME/src/nat20.day/infra/terraform.tfvars"
if [[ -f "$_nat20_tfvars" ]]; then
  export VERCEL_TOKEN=`grep -E "^vercel_api_token" "$_nat20_tfvars" | cut -d'"' -f2`
  export SUPABASE_ACCESS_TOKEN=`grep -E "^supabase_access_token" "$_nat20_tfvars" | cut -d'"' -f2`
fi
```

**Using tokens with CLIs:**
```bash
# Vercel (pass via --token flag)
vercel whoami --token "$VERCEL_TOKEN"

# Supabase (uses SUPABASE_ACCESS_TOKEN env var automatically)
SUPABASE_ACCESS_TOKEN=`grep...` supabase projects list
```

**Monitor Vercel deployments via API:**
```bash
TOKEN=`grep -E "^vercel_api_token" infra/terraform.tfvars | cut -d'"' -f2`
curl -s -H "Authorization: Bearer $TOKEN" "https://api.vercel.com/v6/deployments?limit=3" | \
  jq '.deployments[] | {state: .state, url: .url}'
```

## Coding Conventions

### TypeScript
- Strict mode enabled
- Use Zod schemas for runtime validation
- Prefer `type` over `interface` for consistency

### React
- Functional components only
- Custom hooks for reusable logic
- Co-locate component styles when possible

### Database
- Migrations numbered sequentially: `00001_name.sql`, `00002_name.sql`
- Always enable RLS on new tables
- Use `TIMESTAMPTZ` for timestamps

### API Endpoints
- Use Effect library for error handling
- Return consistent response shapes via `api/lib/response.ts`
- Validate inputs with Zod schemas from `api/lib/schemas.ts`

## Testing

- Tests located alongside source: `*.test.ts` or `*.test.tsx`
- Use Vitest matchers and React Testing Library
- Run `npm run test:watch` during development

## Common Tasks

### Adding a new component
1. Create in appropriate `src/components/` subdirectory
2. Export from component file
3. Import and use in parent component

### Adding a new API endpoint
1. Create handler in `api/` directory
2. Use Effect patterns from existing endpoints
3. Add Zod schema if needed in `api/lib/schemas.ts`

### Modifying database schema
1. Create new migration: `supabase/migrations/0000N_description.sql`
2. Include RLS policies if adding tables
3. Test locally before deploying

### Adding a new hook
1. Create in `src/hooks/`
2. Follow patterns from `useAuth.ts` and `useAvailability.ts`
3. Handle cleanup in `useEffect` return

## D&D Theme Notes

The app uses D&D-themed terminology throughout:
- "Party members" instead of "users"
- "Adventurers" in UI copy
- D&D Beyond-inspired dark theme with fantasy colors
- Random taglines reference D&D gameplay

Maintain this theme in any user-facing copy or UI additions.
- use playwright to capture screenshots