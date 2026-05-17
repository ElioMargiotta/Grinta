# Legacy migrations (archived — DO NOT RUN)

These are the original, hand-numbered SQL files (`0002`–`0020`). They are kept
for historical reference only.

They were **archived on 2026-05-17** because their version names did not match
what the production database (`mmttismftwmgyirzbjhs`) actually tracked in
`supabase_migrations.schema_migrations`. Keeping them in `supabase/migrations/`
would make the Supabase CLI try to re-apply them and fail.

The real schema is now captured by the single baseline migration in
`supabase/migrations/`. See `DEPLOYMENT.md` at the repo root for the workflow.
