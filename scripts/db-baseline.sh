#!/usr/bin/env bash
# Regenerate the production schema baseline migration.
#
# Why this exists: `supabase db dump` needs Docker, and a raw `pg_dump` of a
# Supabase database includes platform statements the `postgres` role cannot
# replay. This script produces a baseline that applies cleanly on any Supabase
# project (prod or a fresh dev copy).
#
# Usage:
#   set -a; . supabase/.env.db; set +a
#   bash scripts/db-baseline.sh
#
# Result: supabase/migrations/<timestamp>_baseline.sql
set -euo pipefail

PGDUMP="${PGDUMP:-/opt/homebrew/opt/libpq/bin/pg_dump}"
: "${SUPABASE_DB_URL_PROD:?set SUPABASE_DB_URL_PROD (source supabase/.env.db)}"

TS=$(date -u +%Y%m%d%H%M%S)
OUT="supabase/migrations/${TS}_baseline.sql"

# 1. Dump ONLY the app-owned schemas (public + private). All other schemas
#    (auth, storage, extensions, ...) are Supabase-managed and already exist.
"$PGDUMP" "$SUPABASE_DB_URL_PROD" --schema-only --no-owner \
  -n public -n private -f "$OUT"

# 2. Strip pg_dump 18 psql meta-commands (not SQL — `supabase db push` runs SQL).
sed -i '' '/^\\restrict /d; /^\\unrestrict /d' "$OUT"

# 3. `public` (and often `private`) already exist on every Supabase project.
sed -i '' \
  's/^CREATE SCHEMA public;/CREATE SCHEMA IF NOT EXISTS public;/; \
   s/^CREATE SCHEMA private;/CREATE SCHEMA IF NOT EXISTS private;/' "$OUT"

# 4. Remove platform default-privilege lines the `postgres` role can't replay
#    (they already exist on every Supabase project). Keep the FOR ROLE postgres
#    ones — those matter so new objects get granted to anon/authenticated.
sed -i '' '/^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin /d' "$OUT"

echo "Baseline written: $OUT ($(wc -l < "$OUT" | tr -d ' ') lines)"
echo "Timestamp: $TS"
