-- =====================================================================
-- 0015 — Security hardening
-- =====================================================================
-- Depends on 0012-0014.
--
-- Addresses staging advisor warnings:
--   - function_search_path_mutable on set_updated_at, teams_sync_billable_count
--   - anon/authenticated_security_definer_function_executable on RLS helpers
--
-- RLS helpers (user_club_access, user_team_access, club_is_active) are
-- moved to a `private` schema so PostgREST does not expose them via
-- /rest/v1/rpc. Business RPCs (create_club, create_invitation,
-- accept_invitation, preview_invitation) stay in public — they are
-- intentionally callable by authenticated users.
--
-- All policies referencing the helpers are dropped and recreated with
-- the private.* qualifier. handle_new_user keeps its trigger binding
-- but loses REST execute (it returns trigger; calling /rpc is useless).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fix search_path on trigger functions (behavior unchanged)
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.teams_sync_billable_count()
returns trigger language plpgsql set search_path = public as $$
declare
  v_club_id uuid;
begin
  v_club_id := coalesce(new.club_id, old.club_id);
  update public.clubs
     set billable_team_count = (
       select count(*) from public.teams
       where club_id = v_club_id and archived_at is null
     )
   where id = v_club_id;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 2. handle_new_user: revoke REST execute. It is only useful as an auth
--    trigger; signed-in users have no reason to call it via /rpc.
-- ---------------------------------------------------------------------
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- 3. Drop policies that depend on the public helpers
-- ---------------------------------------------------------------------
drop policy if exists "profiles_comember_read"        on public.profiles;
drop policy if exists "clubs_member_read"             on public.clubs;
drop policy if exists "clubs_full_update"             on public.clubs;
drop policy if exists "club_roles_member_read"        on public.club_roles;
drop policy if exists "club_roles_full_insert"        on public.club_roles;
drop policy if exists "club_roles_full_update"        on public.club_roles;
drop policy if exists "club_roles_full_delete"        on public.club_roles;
drop policy if exists "club_memberships_read"         on public.club_memberships;
drop policy if exists "club_memberships_full_write"   on public.club_memberships;
drop policy if exists "team_memberships_read"         on public.team_memberships;
drop policy if exists "team_memberships_full_write"   on public.team_memberships;
drop policy if exists "teams_member_read"             on public.teams;
drop policy if exists "teams_full_write"              on public.teams;
drop policy if exists "players_read"                  on public.players;
drop policy if exists "players_write"                 on public.players;
drop policy if exists "sessions_read"                 on public.sessions;
drop policy if exists "sessions_write"                on public.sessions;
drop policy if exists "session_exercises_read"        on public.session_exercises;
drop policy if exists "session_exercises_write"       on public.session_exercises;
drop policy if exists "session_preparations_read"     on public.session_preparations;
drop policy if exists "session_preparations_write"    on public.session_preparations;
drop policy if exists "exercises_read"                on public.exercises;
drop policy if exists "exercises_write"               on public.exercises;
drop policy if exists "macrocycles_read"              on public.macrocycles;
drop policy if exists "macrocycles_write"             on public.macrocycles;
drop policy if exists "mesocycles_read"               on public.mesocycles;
drop policy if exists "mesocycles_write"              on public.mesocycles;
drop policy if exists "microcycles_read"              on public.microcycles;
drop policy if exists "microcycles_write"             on public.microcycles;
drop policy if exists "invitations_admin_read"        on public.club_invitations;
drop policy if exists "invitations_full_write"        on public.club_invitations;
drop policy if exists "billing_events_full_read"      on public.billing_events;

-- ---------------------------------------------------------------------
-- 4. Drop public helpers (no dependent policies remain)
-- ---------------------------------------------------------------------
drop function if exists public.user_team_access(uuid);
drop function if exists public.user_club_access(uuid);
drop function if exists public.club_is_active(uuid);

-- ---------------------------------------------------------------------
-- 5. private schema + helpers
--    PostgREST exposes only the schemas in `db-schemas` (public by
--    default). Functions in `private` are unreachable via /rest/v1/rpc.
-- ---------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.user_club_access(p_club_id uuid)
returns access_level
language sql stable security definer set search_path = public as $$
  select r.access_level
  from public.club_memberships m
  join public.club_roles r on r.id = m.role_id
  where m.user_id = auth.uid()
    and m.club_id = p_club_id
  limit 1
$$;

create or replace function private.user_team_access(p_team_id uuid)
returns access_level
language plpgsql stable security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_lvl access_level;
begin
  select club_id into v_club_id from public.teams where id = p_team_id;
  if v_club_id is null then return null; end if;

  v_lvl := private.user_club_access(v_club_id);
  if v_lvl is null then return null; end if;

  if v_lvl in ('full','extended') then
    return v_lvl;
  end if;

  if exists (
    select 1 from public.team_memberships tm
    join public.club_memberships m on m.id = tm.membership_id
    where tm.team_id = p_team_id and m.user_id = auth.uid()
  ) then
    return v_lvl;
  end if;

  return null;
end $$;

create or replace function private.club_is_active(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select subscription_status in ('active','trialing')
  from public.clubs where id = p_club_id
$$;

grant execute on function private.user_club_access(uuid) to authenticated;
grant execute on function private.user_team_access(uuid) to authenticated;
grant execute on function private.club_is_active(uuid)   to authenticated;

-- ---------------------------------------------------------------------
-- 6. create_invitation rebound to private.user_club_access
-- ---------------------------------------------------------------------
create or replace function public.create_invitation(
  p_club_id  uuid,
  p_email    text,
  p_role_id  uuid,
  p_team_ids uuid[] default '{}',
  p_ttl_hours int default 168
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_role record;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  if private.user_club_access(p_club_id) <> 'full' then
    raise exception 'forbidden: only full-access members can invite';
  end if;

  select id, access_level into v_role
  from public.club_roles where id = p_role_id and club_id = p_club_id;

  if v_role is null then
    raise exception 'role does not belong to this club';
  end if;

  if v_role.access_level in ('team','team_readonly') and (p_team_ids is null or array_length(p_team_ids,1) is null) then
    raise exception 'team-scoped role requires at least one team';
  end if;

  if v_role.access_level in ('full','extended') and p_team_ids is not null and array_length(p_team_ids,1) is not null then
    raise exception 'club-wide role must not specify teams';
  end if;

  v_token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+','-'), '/','_'), '=','');

  delete from public.club_invitations
   where club_id = p_club_id and lower(email) = lower(p_email) and accepted_at is null;

  insert into public.club_invitations (club_id, email, role_id, team_ids, invited_by, token, expires_at)
  values (p_club_id, lower(p_email), p_role_id, coalesce(p_team_ids, '{}'::uuid[]),
          auth.uid(), v_token, now() + (p_ttl_hours || ' hours')::interval);

  return v_token;
end $$;

grant execute on function public.create_invitation(uuid, text, uuid, uuid[], int) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Recreate all policies using private.* helpers
-- ---------------------------------------------------------------------

-- PROFILES (profiles_self_read/write from 0013 unchanged)
create policy "profiles_comember_read" on public.profiles
  for select using (
    exists (
      select 1
      from public.club_memberships m1
      join public.club_memberships m2 on m2.club_id = m1.club_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );

-- CLUBS
create policy "clubs_member_read" on public.clubs
  for select using (private.user_club_access(id) is not null);

create policy "clubs_full_update" on public.clubs
  for update
  using      (private.user_club_access(id) = 'full')
  with check (private.user_club_access(id) = 'full');

-- CLUB_ROLES
create policy "club_roles_member_read" on public.club_roles
  for select using (private.user_club_access(club_id) is not null);

create policy "club_roles_full_insert" on public.club_roles
  for insert with check (
    private.user_club_access(club_id) = 'full' and not is_system
  );

create policy "club_roles_full_update" on public.club_roles
  for update
  using      (private.user_club_access(club_id) = 'full' and not is_system)
  with check (private.user_club_access(club_id) = 'full' and not is_system);

create policy "club_roles_full_delete" on public.club_roles
  for delete using (private.user_club_access(club_id) = 'full' and not is_system);

-- CLUB_MEMBERSHIPS
create policy "club_memberships_read" on public.club_memberships
  for select using (
    user_id = auth.uid()
    or private.user_club_access(club_id) in ('full','extended')
  );

create policy "club_memberships_full_write" on public.club_memberships
  for all
  using      (private.user_club_access(club_id) = 'full')
  with check (private.user_club_access(club_id) = 'full');

-- TEAM_MEMBERSHIPS
create policy "team_memberships_read" on public.team_memberships
  for select using (
    private.user_team_access(team_id) is not null
    or exists (
      select 1 from public.club_memberships m
      where m.id = team_memberships.membership_id and m.user_id = auth.uid()
    )
  );

create policy "team_memberships_full_write" on public.team_memberships
  for all
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_memberships.team_id
        and private.user_club_access(t.club_id) = 'full'
    )
  )
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_memberships.team_id
        and private.user_club_access(t.club_id) = 'full'
    )
  );

-- TEAMS
create policy "teams_member_read" on public.teams
  for select using (private.user_team_access(id) is not null);

create policy "teams_full_write" on public.teams
  for all
  using      (private.user_club_access(club_id) = 'full' and private.club_is_active(club_id))
  with check (private.user_club_access(club_id) = 'full' and private.club_is_active(club_id));

-- PLAYERS
create policy "players_read" on public.players
  for select using (private.user_team_access(team_id) is not null);

create policy "players_write" on public.players
  for all
  using (
    private.user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from public.teams t where t.id = players.team_id and private.club_is_active(t.club_id))
  )
  with check (
    private.user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from public.teams t where t.id = players.team_id and private.club_is_active(t.club_id))
  );

-- SESSIONS
create policy "sessions_read" on public.sessions
  for select using (private.user_team_access(team_id) is not null);

create policy "sessions_write" on public.sessions
  for all
  using (
    private.user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from public.teams t where t.id = sessions.team_id and private.club_is_active(t.club_id))
  )
  with check (
    private.user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from public.teams t where t.id = sessions.team_id and private.club_is_active(t.club_id))
  );

-- SESSION_EXERCISES
create policy "session_exercises_read" on public.session_exercises
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = session_exercises.session_id
        and private.user_team_access(s.team_id) is not null
    )
  );

create policy "session_exercises_write" on public.session_exercises
  for all
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_exercises.session_id
        and private.user_team_access(s.team_id) in ('full','extended','team')
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_exercises.session_id
        and private.user_team_access(s.team_id) in ('full','extended','team')
    )
  );

-- SESSION_PREPARATIONS
create policy "session_preparations_read" on public.session_preparations
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = session_preparations.session_id
        and private.user_team_access(s.team_id) is not null
    )
  );

create policy "session_preparations_write" on public.session_preparations
  for all
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_preparations.session_id
        and private.user_team_access(s.team_id) in ('full','extended','team')
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_preparations.session_id
        and private.user_team_access(s.team_id) in ('full','extended','team')
    )
  );

-- EXERCISES
create policy "exercises_read" on public.exercises
  for select using (
    club_id is null
    or private.user_club_access(club_id) is not null
  );

create policy "exercises_write" on public.exercises
  for all
  using (
    club_id is not null
    and private.user_club_access(club_id) in ('full','extended','team')
  )
  with check (
    club_id is not null
    and private.user_club_access(club_id) in ('full','extended','team')
  );

-- MACROCYCLES
create policy "macrocycles_read" on public.macrocycles
  for select using (private.user_team_access(team_id) is not null);

create policy "macrocycles_write" on public.macrocycles
  for all
  using      (private.user_team_access(team_id) in ('full','extended','team'))
  with check (private.user_team_access(team_id) in ('full','extended','team'));

-- MESOCYCLES
create policy "mesocycles_read" on public.mesocycles
  for select using (
    exists (
      select 1 from public.macrocycles m
      where m.id = mesocycles.macrocycle_id and private.user_team_access(m.team_id) is not null
    )
  );

create policy "mesocycles_write" on public.mesocycles
  for all
  using (
    exists (
      select 1 from public.macrocycles m
      where m.id = mesocycles.macrocycle_id
        and private.user_team_access(m.team_id) in ('full','extended','team')
    )
  )
  with check (
    exists (
      select 1 from public.macrocycles m
      where m.id = mesocycles.macrocycle_id
        and private.user_team_access(m.team_id) in ('full','extended','team')
    )
  );

-- MICROCYCLES
create policy "microcycles_read" on public.microcycles
  for select using (
    exists (
      select 1
      from public.mesocycles me
      join public.macrocycles ma on ma.id = me.macrocycle_id
      where me.id = microcycles.mesocycle_id
        and private.user_team_access(ma.team_id) is not null
    )
  );

create policy "microcycles_write" on public.microcycles
  for all
  using (
    exists (
      select 1
      from public.mesocycles me
      join public.macrocycles ma on ma.id = me.macrocycle_id
      where me.id = microcycles.mesocycle_id
        and private.user_team_access(ma.team_id) in ('full','extended','team')
    )
  )
  with check (
    exists (
      select 1
      from public.mesocycles me
      join public.macrocycles ma on ma.id = me.macrocycle_id
      where me.id = microcycles.mesocycle_id
        and private.user_team_access(ma.team_id) in ('full','extended','team')
    )
  );

-- CLUB_INVITATIONS
create policy "invitations_admin_read" on public.club_invitations
  for select using (private.user_club_access(club_id) in ('full','extended'));

create policy "invitations_full_write" on public.club_invitations
  for all
  using      (private.user_club_access(club_id) = 'full')
  with check (private.user_club_access(club_id) = 'full');

-- BILLING_EVENTS
create policy "billing_events_full_read" on public.billing_events
  for select using (private.user_club_access(club_id) = 'full');
