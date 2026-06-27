# Database Deployment Runbook

This is the single source of truth for how the Grinta database is structured and
how schema changes go to production. Follow it exactly.

## 1. Mental model — two databases

| Name           | Supabase project ref     | Purpose                                              |
| -------------- | ------------------------ | ---------------------------------------------------- |
| **PRODUCTION** | `mmttismftwmgyirzbjhs`   | Live database. Real paying customers. Never reset.   |
| **DEV COPY**   | `csnxaznrrojgvwjjpjvw`   | A copy of production. Safe place to test changes.    |

- Local app (`npm run dev`) and `.env.local` point at the **DEV COPY**.
- The Vercel production deployment points at **PRODUCTION** (env vars set in the
  Vercel dashboard, never committed).
- Every schema change is **one migration file** in `supabase/migrations/`.
  It is applied to the DEV COPY first to test, then to PRODUCTION after merge.

The golden rule: **the `supabase/migrations/` folder is the truth.** What is in
that folder, applied in order, *is* the schema. Nothing is changed by hand in
the Supabase dashboard.

> The old hand-numbered files were moved to `supabase/migrations_legacy/` because
> they no longer matched what production actually had. Do not run them.

---

## 2. One-time setup (do this once, in order)

You need the Supabase CLI (already installed: `supabase --version` → 2.98.x) and
the database passwords from the Supabase dashboard
(**Project → Settings → Database → Database password**).

### 2.1 Create the DB connection file

```bash
cp supabase/.env.db.example supabase/.env.db
```

Open `supabase/.env.db` and fill in the two connection strings. Get each one
from **Supabase dashboard → your project → Connect → Direct connection (URI)**
and put the database password in place of `[YOUR-PASSWORD]`.
This file is gitignored — it never gets committed.

Load it into your shell whenever you run db commands:

```bash
set -a; . supabase/.env.db; set +a
```

### 2.2 Supabase CLI login — NOT required

Every command in this runbook uses `--db-url` (a direct Postgres connection),
so `supabase login` / an access token is **not needed**. You'd only need it for
`supabase link`, branching, or the Management API, which this workflow avoids.

(If you ever do need it: create a token at
https://supabase.com/dashboard/account/tokens and run
`export SUPABASE_ACCESS_TOKEN=<token>` — the browser login flow doesn't work in
non-interactive shells.)

> Requires `pg_dump`/`psql` 17+ (e.g. `brew install libpq`; binaries at
> `/opt/homebrew/opt/libpq/bin`). The `supabase db dump` CLI command is NOT
> used — it needs Docker, and a raw Supabase dump contains platform statements
> the `postgres` role can't replay. `scripts/db-baseline.sh` handles all of it.

### 2.3 Capture production's real schema as the baseline

```bash
set -a; . supabase/.env.db; set +a
bash scripts/db-baseline.sh          # -> supabase/migrations/<ts>_baseline.sql
```

This dumps the app schemas (`public` + `private`), strips pg_dump psql
meta-commands, makes `CREATE SCHEMA` idempotent, and removes the
`supabase_admin` default-privilege lines (already present on every Supabase
project). Note the printed timestamp — call it `$TS`.

Reconcile production's migration history so it contains **only** the baseline
(the old hand-numbered rows don't match any file). This writes only to the
`supabase_migrations` bookkeeping table — no data or schema is touched:

```bash
PSQL=/opt/homebrew/opt/libpq/bin/psql
# safety backup of the old history
$PSQL "$SUPABASE_DB_URL_PROD" -At -c \
  "copy (select version,name from supabase_migrations.schema_migrations order by version) to stdout" \
  > supabase/migrations_legacy/_prod_history_backup.tsv
# replace history with just the baseline row
$PSQL "$SUPABASE_DB_URL_PROD" -v ON_ERROR_STOP=1 <<SQL
begin;
delete from supabase_migrations.schema_migrations;
insert into supabase_migrations.schema_migrations (version, name) values ('$TS','baseline');
commit;
SQL
supabase migration list --db-url "$SUPABASE_DB_URL_PROD"   # Local == Remote == $TS
```

Commit the baseline:

```bash
git add supabase/ && git commit -m "chore(db): production schema baseline"
```

### 2.4 Build the DEV COPY from production

Make the dev project a structural copy of production.

1. Wipe the dev copy's app schemas (this **deletes everything in the dev
   project** — that's intended; it's the throwaway copy):

   ```bash
   set -a; . supabase/.env.db; set +a
   /opt/homebrew/opt/libpq/bin/psql "$SUPABASE_DB_URL_DEV" -v ON_ERROR_STOP=1 <<'SQL'
   begin;
   drop schema if exists public cascade;
   drop schema if exists private cascade;
   create schema public;
   grant usage on schema public to anon, authenticated, service_role;
   grant all on schema public to postgres, service_role;
   commit;
   SQL
   ```

2. Apply the baseline (also records it in the dev migration history):

   ```bash
   npm run db:push:dev
   ```

3. Verify dev == prod:

   ```bash
   supabase migration list --db-url "$SUPABASE_DB_URL_DEV"   # Local == Remote
   ```

4. (Optional) Copy production *data* into the dev copy. Skipped by default —
   the dev copy starts empty with an identical schema, which is all that is
   needed to test migrations. Copying data also pulls real user rows and has
   `auth.users` foreign-key dependencies; do it deliberately, not as routine.

5. Point local dev at the dev copy: `.env.local` must have the **DEV COPY**
   URL + anon key (see `.env.example`).

Setup is now done. The dev copy and production have identical schema, and the
migrations folder describes it.

### 2.5 Auth URLs — email & phone verification (per project)

Email confirmation links and phone/OTP redirects are generated by **Supabase
Auth** using each project's **Site URL**. This is set in the **dashboard**, per
project — NOT in code, migrations, or `config.toml`.

> The `[auth] site_url` line in `supabase/config.toml` only affects a *local*
> `supabase start` stack (which we don't use). Ignore it.

In **Supabase dashboard → Authentication → URL Configuration**:

| Project | Site URL | Redirect URLs (allow-list) |
| ------- | -------- | -------------------------- |
| **PRODUCTION** `mmttismftwmgyirzbjhs` | `https://grintaclub.app` | `https://grintaclub.app/**` |
| **DEV COPY** `csnxaznrrojgvwjjpjvw`   | `http://localhost:3000`  | `http://localhost:3000/**` |

> ⚠️ Use the public custom domain **`grintaclub.app`**, NOT the Vercel
> deployment URL. `grinta-staged.vercel.app` has Vercel Deployment Protection
> enabled and returns **401** to anonymous requests, so confirmation-email
> images and the post-confirm redirect (`/{locale}/confirm`) hit an auth wall
> when they go through that domain.

The app also builds some links itself from `NEXT_PUBLIC_SITE_URL`
(e.g. club invitations, auth email redirects). Set it to match each environment:

- `.env.local` → `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- Vercel (Production scope) → `NEXT_PUBLIC_SITE_URL=https://grintaclub.app`

So: sign up on the live site → confirmation email link verifies, then
redirects to `https://grintaclub.app/{locale}/confirm` ("Email verified")
→ auto-redirect to the login page. Sign up while developing → it points to
localhost.

---

## 3. Everyday workflow — making a change and shipping it

Every schema change follows the same five steps.

### Step 1 — Branch

```bash
git checkout main && git pull
git checkout -b feature/short-description
```

### Step 2 — Create a migration

```bash
npm run db:new -- add_player_notes_column
```

This creates `supabase/migrations/<timestamp>_add_player_notes_column.sql`.
Write your SQL in that file. Prefer **additive** changes (add columns/tables)
so old and new app code both keep working during deploy.

### Step 3 — Test it on the DEV COPY

```bash
set -a; . supabase/.env.db; set +a
npm run db:push:dev
```

Then run the app against the dev copy and verify:

```bash
npm run dev
```

If something is wrong, fix the migration file and push again. (If you need a
clean slate, redo section 2.4 for the dev copy.)

### Step 4 — Commit, PR, merge

```bash
git add supabase/migrations/ src/
git commit -m "feat: player notes"
git push -u origin feature/short-description
```

Open the PR, get it reviewed, **merge to `main`**. Vercel will start deploying
the new app code automatically.

### Step 5 — Apply the migration to PRODUCTION

Right after merging, run:

```bash
git checkout main && git pull
set -a; . supabase/.env.db; set +a
npm run db:push:prod          # add --dry-run first if you want to preview
```

`supabase db push` only applies migrations that production hasn't seen yet, so
this is safe to run repeatedly. Production is now migrated. Done.

> **Ordering:** because migrations are additive, it's fine if the Vercel app
> deploy finishes a moment before/after the prod migration. For a *breaking*
> change, do it in two PRs: (1) additive migration + code that works both ways,
> (2) later cleanup migration that removes the old column.

---

## 4. Quick cheat sheet

```bash
# load db credentials (every new shell)
set -a; . supabase/.env.db; set +a

npm run db:new -- my_change      # create a migration file
npm run db:push:dev              # apply pending migrations to DEV COPY
npm run db:status:dev            # what's applied on the dev copy
npm run db:push:prod             # apply pending migrations to PRODUCTION
npm run db:status:prod           # what's applied on production
```

---

## 5. Safety rules

- **Never** edit the schema by hand in the dashboard. Always a migration file.
- **Never** run `db:push:prod` from an unmerged branch — only from `main`.
- **Never** point `.env.local` or `npm run dev` at production.
- Prefer additive migrations. Two-step any destructive change.
- Before a risky prod migration, take a backup: Supabase dashboard →
  Database → Backups (or `supabase db dump --db-url "$SUPABASE_DB_URL_PROD"`).
- `supabase/.env.db` holds DB passwords — it is gitignored, keep it that way.

## 5b. Auth providers & anti-bot (Lot A — comptes joueur/parent/staff)

Configuration **hors migrations** (dashboard Supabase + Vercel) :

### OAuth Google / Apple
1. Supabase → Authentication → Providers → **Google** : activer, coller le
   Client ID / Secret (Google Cloud Console → OAuth consent + Credentials).
2. Supabase → Providers → **Apple** : activer, renseigner Services ID + clé
   (Apple Developer, ~99 $/an). Activable plus tard sans casser Google.
3. Authentication → URL Configuration → **Redirect URLs** : ajouter
   `https://grintaclub.app/*/auth/callback` (prod), les URLs de preview Vercel
   (`https://*.vercel.app/*/auth/callback`) et `http://localhost:3000/*/auth/callback`.
4. Rien à coder : les boutons appellent `signInWithOAuth` → route
   `/{locale}/auth/callback` (déjà en place).

### CAPTCHA anti-bot (Cloudflare Turnstile — gratuit, optionnel)
1. Cloudflare → Turnstile → créer un widget → **site key** + **secret**.
2. Supabase → Authentication → Settings → **Enable CAPTCHA protection** →
   Turnstile → coller le secret. (S'applique à signup **et** login **et** reset
   password — les trois formulaires envoient déjà le token `cf-turnstile-response`.)
3. Vercel env : `NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key>` (et `.env.local` en dev).
   Sans cette variable le widget ne s'affiche pas et l'auth reste inchangée.

## 6. Troubleshooting

- **`db push` wants to re-run the baseline on production** → the
  `migration repair --status applied` step (2.3) was skipped. Re-run it.
- **"relation already exists" on dev push** → the dev copy wasn't wiped; redo
  section 2.4.
- **Migration applied to prod but app errors** → app code expected the new
  schema before the migration ran. Re-deploy on Vercel, or roll forward with a
  fixing migration. Avoid by keeping migrations additive.
