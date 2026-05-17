-- =====================================================================
-- 0013 — RLS rewrite: club-based access control
-- =====================================================================
-- Depends on 0012_multi_tenant_clubs.sql.
--
-- Access resolution per team:
--   - user has full or extended on the team's club  → access_level
--   - user has team / team_readonly + team_membership for that team → access_level
--   - otherwise                                                    → null
--
-- Write gate: club must be in ('active','trialing') to allow writes
-- on tenant-owned data (teams, players, sessions, ...).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions (security definer to bypass nested RLS recursion)
-- ---------------------------------------------------------------------
create or replace function user_club_access(p_club_id uuid)
returns access_level
language sql stable security definer set search_path = public as $$
  select r.access_level
  from club_memberships m
  join club_roles r on r.id = m.role_id
  where m.user_id = auth.uid()
    and m.club_id = p_club_id
  limit 1
$$;

create or replace function user_team_access(p_team_id uuid)
returns access_level
language plpgsql stable security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_lvl access_level;
begin
  select club_id into v_club_id from teams where id = p_team_id;
  if v_club_id is null then return null; end if;

  v_lvl := user_club_access(v_club_id);
  if v_lvl is null then return null; end if;

  if v_lvl in ('full','extended') then
    return v_lvl;
  end if;

  -- team / team_readonly: require explicit assignment
  if exists (
    select 1 from team_memberships tm
    join club_memberships m on m.id = tm.membership_id
    where tm.team_id = p_team_id and m.user_id = auth.uid()
  ) then
    return v_lvl;
  end if;

  return null;
end $$;

create or replace function club_is_active(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select subscription_status in ('active','trialing')
  from clubs where id = p_club_id
$$;

grant execute on function user_club_access(uuid)  to authenticated;
grant execute on function user_team_access(uuid)  to authenticated;
grant execute on function club_is_active(uuid)    to authenticated;

-- ---------------------------------------------------------------------
-- create_club(name) — bootstrap a new tenant atomically.
-- Caller becomes Propriétaire (full). Returns the new club_id.
-- ---------------------------------------------------------------------
create or replace function create_club(p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_owner_role_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  insert into clubs (name, subscription_status, trial_ends_at)
  values (coalesce(nullif(trim(p_name), ''), 'Mon club'),
          'trialing',
          now() + interval '14 days')
  returning id into v_club_id;

  insert into club_roles (club_id, name, access_level, is_system)
  values (v_club_id, 'Propriétaire', 'full', true)
  returning id into v_owner_role_id;

  insert into club_roles (club_id, name, access_level, is_system)
  values (v_club_id, 'Coach', 'team', true);

  insert into club_memberships (club_id, user_id, role_id)
  values (v_club_id, auth.uid(), v_owner_role_id);

  return v_club_id;
end $$;

grant execute on function create_club(text) to authenticated;

-- =====================================================================
-- PROFILES
-- =====================================================================
create policy "profiles_self_read" on profiles
  for select using (auth.uid() = id);

create policy "profiles_self_write" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Co-members of any of my clubs can see each other (for member lists).
create policy "profiles_comember_read" on profiles
  for select using (
    exists (
      select 1
      from club_memberships m1
      join club_memberships m2 on m2.club_id = m1.club_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );

-- =====================================================================
-- CLUBS
-- =====================================================================
create policy "clubs_member_read" on clubs
  for select using (user_club_access(id) is not null);

create policy "clubs_full_update" on clubs
  for update
  using      (user_club_access(id) = 'full')
  with check (user_club_access(id) = 'full');

-- INSERT happens through create_club() only (security definer).
-- DELETE forbidden via UI — cancel subscription instead.

-- =====================================================================
-- CLUB_ROLES  (read: any member ; write: full, but is_system protected)
-- =====================================================================
create policy "club_roles_member_read" on club_roles
  for select using (user_club_access(club_id) is not null);

create policy "club_roles_full_insert" on club_roles
  for insert with check (
    user_club_access(club_id) = 'full' and not is_system
  );

create policy "club_roles_full_update" on club_roles
  for update
  using      (user_club_access(club_id) = 'full' and not is_system)
  with check (user_club_access(club_id) = 'full' and not is_system);

create policy "club_roles_full_delete" on club_roles
  for delete using (user_club_access(club_id) = 'full' and not is_system);

-- =====================================================================
-- CLUB_MEMBERSHIPS
-- =====================================================================
create policy "club_memberships_read" on club_memberships
  for select using (
    user_id = auth.uid()
    or user_club_access(club_id) in ('full','extended')
  );

create policy "club_memberships_full_write" on club_memberships
  for all
  using      (user_club_access(club_id) = 'full')
  with check (user_club_access(club_id) = 'full');

-- =====================================================================
-- TEAM_MEMBERSHIPS
-- =====================================================================
create policy "team_memberships_read" on team_memberships
  for select using (
    -- I see assignments for teams I have access to
    user_team_access(team_id) is not null
    -- or my own assignments (defensive)
    or exists (
      select 1 from club_memberships m
      where m.id = team_memberships.membership_id and m.user_id = auth.uid()
    )
  );

create policy "team_memberships_full_write" on team_memberships
  for all
  using (
    exists (
      select 1 from teams t
      where t.id = team_memberships.team_id
        and user_club_access(t.club_id) = 'full'
    )
  )
  with check (
    exists (
      select 1 from teams t
      where t.id = team_memberships.team_id
        and user_club_access(t.club_id) = 'full'
    )
  );

-- =====================================================================
-- TEAMS
-- =====================================================================
create policy "teams_member_read" on teams
  for select using (user_team_access(id) is not null);

create policy "teams_full_write" on teams
  for all
  using      (user_club_access(club_id) = 'full' and club_is_active(club_id))
  with check (user_club_access(club_id) = 'full' and club_is_active(club_id));

-- =====================================================================
-- PLAYERS
-- =====================================================================
create policy "players_read" on players
  for select using (user_team_access(team_id) is not null);

create policy "players_write" on players
  for all
  using (
    user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from teams t where t.id = players.team_id and club_is_active(t.club_id))
  )
  with check (
    user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from teams t where t.id = players.team_id and club_is_active(t.club_id))
  );

-- =====================================================================
-- SESSIONS
-- =====================================================================
create policy "sessions_read" on sessions
  for select using (user_team_access(team_id) is not null);

create policy "sessions_write" on sessions
  for all
  using (
    user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from teams t where t.id = sessions.team_id and club_is_active(t.club_id))
  )
  with check (
    user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from teams t where t.id = sessions.team_id and club_is_active(t.club_id))
  );

-- =====================================================================
-- SESSION_EXERCISES
-- =====================================================================
create policy "session_exercises_read" on session_exercises
  for select using (
    exists (
      select 1 from sessions s
      where s.id = session_exercises.session_id
        and user_team_access(s.team_id) is not null
    )
  );

create policy "session_exercises_write" on session_exercises
  for all
  using (
    exists (
      select 1 from sessions s
      where s.id = session_exercises.session_id
        and user_team_access(s.team_id) in ('full','extended','team')
    )
  )
  with check (
    exists (
      select 1 from sessions s
      where s.id = session_exercises.session_id
        and user_team_access(s.team_id) in ('full','extended','team')
    )
  );

-- =====================================================================
-- SESSION_PREPARATIONS
-- =====================================================================
create policy "session_preparations_read" on session_preparations
  for select using (
    exists (
      select 1 from sessions s
      where s.id = session_preparations.session_id
        and user_team_access(s.team_id) is not null
    )
  );

create policy "session_preparations_write" on session_preparations
  for all
  using (
    exists (
      select 1 from sessions s
      where s.id = session_preparations.session_id
        and user_team_access(s.team_id) in ('full','extended','team')
    )
  )
  with check (
    exists (
      select 1 from sessions s
      where s.id = session_preparations.session_id
        and user_team_access(s.team_id) in ('full','extended','team')
    )
  );

-- =====================================================================
-- EXERCISES  (club-owned + global library where club_id is null)
-- =====================================================================
create policy "exercises_read" on exercises
  for select using (
    club_id is null  -- global library, readable by any authenticated user
    or user_club_access(club_id) is not null
  );

create policy "exercises_write" on exercises
  for all
  using (
    club_id is not null
    and user_club_access(club_id) in ('full','extended','team')
  )
  with check (
    club_id is not null
    and user_club_access(club_id) in ('full','extended','team')
  );

-- =====================================================================
-- MACROCYCLES / MESOCYCLES / MICROCYCLES
-- =====================================================================
create policy "macrocycles_read" on macrocycles
  for select using (user_team_access(team_id) is not null);

create policy "macrocycles_write" on macrocycles
  for all
  using      (user_team_access(team_id) in ('full','extended','team'))
  with check (user_team_access(team_id) in ('full','extended','team'));

create policy "mesocycles_read" on mesocycles
  for select using (
    exists (
      select 1 from macrocycles m
      where m.id = mesocycles.macrocycle_id and user_team_access(m.team_id) is not null
    )
  );

create policy "mesocycles_write" on mesocycles
  for all
  using (
    exists (
      select 1 from macrocycles m
      where m.id = mesocycles.macrocycle_id
        and user_team_access(m.team_id) in ('full','extended','team')
    )
  )
  with check (
    exists (
      select 1 from macrocycles m
      where m.id = mesocycles.macrocycle_id
        and user_team_access(m.team_id) in ('full','extended','team')
    )
  );

create policy "microcycles_read" on microcycles
  for select using (
    exists (
      select 1
      from mesocycles me
      join macrocycles ma on ma.id = me.macrocycle_id
      where me.id = microcycles.mesocycle_id
        and user_team_access(ma.team_id) is not null
    )
  );

create policy "microcycles_write" on microcycles
  for all
  using (
    exists (
      select 1
      from mesocycles me
      join macrocycles ma on ma.id = me.macrocycle_id
      where me.id = microcycles.mesocycle_id
        and user_team_access(ma.team_id) in ('full','extended','team')
    )
  )
  with check (
    exists (
      select 1
      from mesocycles me
      join macrocycles ma on ma.id = me.macrocycle_id
      where me.id = microcycles.mesocycle_id
        and user_team_access(ma.team_id) in ('full','extended','team')
    )
  );

-- =====================================================================
-- CLUB_INVITATIONS  (read/write: full ; accept flow handled in app code)
-- =====================================================================
create policy "invitations_admin_read" on club_invitations
  for select using (user_club_access(club_id) in ('full','extended'));

create policy "invitations_full_write" on club_invitations
  for all
  using      (user_club_access(club_id) = 'full')
  with check (user_club_access(club_id) = 'full');

-- =====================================================================
-- BILLING_EVENTS  (read: full ; writes only via service role in webhook)
-- =====================================================================
create policy "billing_events_full_read" on billing_events
  for select using (user_club_access(club_id) = 'full');
