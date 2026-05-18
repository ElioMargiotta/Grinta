-- Restore the auth.users -> public.profiles trigger.
--
-- Why this migration exists:
-- The baseline is produced by scripts/db-baseline.sh, which dumps only the
-- `public` and `private` schemas. The signup trigger lives on `auth.users`
-- (the `auth` schema), so it was NOT captured in the baseline. Any database
-- built from the baseline (the DEV COPY, and any future restore) ends up with
-- the handle_new_user() function but no trigger calling it. New signups then
-- create an auth.users row with no matching public.profiles row, and the first
-- write that references profiles (e.g. inserting a session: sessions.trainer_id
-- -> profiles.id) fails with sessions_trainer_id_fkey.
--
-- This migration is idempotent: on PRODUCTION (where the trigger already
-- exists) it is a no-op; on the DEV COPY it adds the missing trigger.

-- Function (CREATE OR REPLACE so this file is self-contained and matches prod).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant all on function public.handle_new_user() to service_role;

-- Trigger on auth.users.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any existing user that signed up while the trigger was missing.
insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
