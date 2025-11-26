# NAT 20

D&D session scheduler. Tracks party availability on Thursday/Friday dates.

## Setup

```bash
npm install
cp .env.local.example .env.local  # add Supabase credentials
cp supabase/seed.sql.example supabase/seed.sql  # add party members
npm run db:seed
npm run dev
```

## Environment Variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Google OAuth

1. Create credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Add redirect URI: `https://<project-id>.supabase.co/auth/v1/callback`
3. Configure in Supabase Dashboard → Authentication → Providers → Google

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run test       # run tests
npm run lint       # eslint
npm run typecheck  # typescript
npm run db:seed    # apply seed data
```

## Stack

- React 19, TypeScript, Vite
- Supabase (Postgres, Auth, Realtime)
- Terraform (Vercel, Cloudflare)
