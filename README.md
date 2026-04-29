# Grinta

Web app for football trainers — auth, season planner (year/month/week/day), exercise library, teams + players. Built with Next.js (App Router) + Supabase + next-intl + FullCalendar.

## Setup

### 1. Supabase project

1. Create a new project at <https://supabase.com>.
2. In the SQL editor, run the contents of `supabase/schema.sql` once. This creates all tables, the `handle_new_user` trigger, and Row Level Security policies.
3. Copy the project URL and `anon` key from **Project Settings → API**.

### 2. Local env

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000> — you'll be redirected to `/en`.

## Routes

- `/[locale]/login`, `/[locale]/signup`
- `/[locale]/dashboard`
- `/[locale]/teams`, `/[locale]/teams/new`, `/[locale]/teams/[teamId]`, `/[locale]/teams/[teamId]/players`
- `/[locale]/exercises`, `/[locale]/exercises/new`, `/[locale]/exercises/[exerciseId]`
- `/[locale]/planner`, `/[locale]/planner/[teamId]?view=year|month|week|day`
- `/[locale]/planner/[teamId]/sessions/new?date=YYYY-MM-DD`
- `/[locale]/planner/[teamId]/sessions/[sessionId]`

## i18n

`src/messages/en.json` is the source of truth. `src/messages/fr.json` mirrors the same keys with empty strings — fill them in when ready to ship the French version. No code changes needed.

## Data model

All trainer-owned rows have `trainer_id = auth.uid()` and are gated by RLS. The schema is additive: a future paid tier can add a `visibility` column on `exercises` plus a sharing table without touching the rest of the app.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — lint
