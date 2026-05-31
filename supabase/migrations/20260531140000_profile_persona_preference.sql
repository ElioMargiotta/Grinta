-- Persona preference on profiles: lets a user declare at signup whether they
-- intend to be a staff member (entraîneur), a player, or both. Drives the
-- view-switcher availability before any club membership or players row exists.
--
-- RLS on profiles + self-update policy already exist in the baseline, so this
-- migration only adds the column and refreshes the signup trigger.

alter table public.profiles
  add column if not exists persona_preference text not null default 'staff'
    check (persona_preference in ('staff', 'player', 'dual'));

-- Rewrite the signup trigger so it picks up the value from raw_user_meta_data
-- (set by signupAction). Falls back to 'staff' when missing — matches the
-- column default and preserves prior behavior for existing accounts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  pref text := coalesce(new.raw_user_meta_data->>'persona_preference', 'staff');
begin
  if pref not in ('staff', 'player', 'dual') then
    pref := 'staff';
  end if;

  insert into profiles (id, full_name, persona_preference)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), pref)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant all on function public.handle_new_user() to service_role;
