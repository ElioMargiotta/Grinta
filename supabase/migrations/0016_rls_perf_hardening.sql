-- =====================================================================
-- 0016 — RLS performance hardening
-- =====================================================================
-- Depends on 0015.
--
-- Addresses staging performance advisor warnings:
--   1. unindexed_foreign_keys — add covering indexes on FKs (esp.
--      teams.club_id, used in every user_team_access() helper call).
--   2. auth_rls_initplan — wrap auth.uid() in (select auth.uid()) so it
--      is evaluated once per query instead of once per row.
--   3. multiple_permissive_policies — split `for all` write policies
--      into separate insert/update/delete so the read policy is the
--      only one evaluated on SELECT.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Missing FK indexes
-- ---------------------------------------------------------------------
create index if not exists teams_club_idx                       on public.teams (club_id);
create index if not exists exercises_club_idx                   on public.exercises (club_id);
create index if not exists club_invitations_invited_by_idx      on public.club_invitations (invited_by);
create index if not exists club_invitations_role_idx            on public.club_invitations (role_id);
create index if not exists club_memberships_role_idx            on public.club_memberships (role_id);
create index if not exists session_exercises_exercise_idx       on public.session_exercises (exercise_id);

-- Legacy single-trainer FKs (kept for backward compat until step 6 removes them)
create index if not exists macrocycles_trainer_idx              on public.macrocycles (trainer_id);
create index if not exists mesocycles_trainer_idx               on public.mesocycles (trainer_id);
create index if not exists microcycles_trainer_idx              on public.microcycles (trainer_id);
create index if not exists players_trainer_idx                  on public.players (trainer_id);
create index if not exists session_preparations_trainer_idx     on public.session_preparations (trainer_id);
create index if not exists sessions_trainer_idx                 on public.sessions (trainer_id);

-- ---------------------------------------------------------------------
-- 2. Drop all policies that we are about to rewrite (auth.uid() wrap + split)
-- ---------------------------------------------------------------------
drop policy if exists "profiles_self_read"            on public.profiles;
drop policy if exists "profiles_self_write"           on public.profiles;
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
-- 3. Recreate policies with:
--      - (select auth.uid()) wrapping  (initplan caching)
--      - split for-all writes into insert/update/delete
--      - read = for select (no overlap with writes)
-- ---------------------------------------------------------------------

-- PROFILES ------------------------------------------------------------
-- Single combined read policy avoids two permissive policies on SELECT.
create policy "profiles_read" on public.profiles
  for select using (
    (select auth.uid()) = id
    or exists (
      select 1
      from public.club_memberships m1
      join public.club_memberships m2 on m2.club_id = m1.club_id
      where m1.user_id = (select auth.uid()) and m2.user_id = profiles.id
    )
  );

create policy "profiles_self_update" on public.profiles
  for update
  using      ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- CLUBS ---------------------------------------------------------------
create policy "clubs_member_read" on public.clubs
  for select using (private.user_club_access(id) is not null);

create policy "clubs_full_update" on public.clubs
  for update
  using      (private.user_club_access(id) = 'full')
  with check (private.user_club_access(id) = 'full');

-- CLUB_ROLES ----------------------------------------------------------
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

-- CLUB_MEMBERSHIPS ----------------------------------------------------
create policy "club_memberships_read" on public.club_memberships
  for select using (
    user_id = (select auth.uid())
    or private.user_club_access(club_id) in ('full','extended')
  );

create policy "club_memberships_full_insert" on public.club_memberships
  for insert with check (private.user_club_access(club_id) = 'full');

create policy "club_memberships_full_update" on public.club_memberships
  for update
  using      (private.user_club_access(club_id) = 'full')
  with check (private.user_club_access(club_id) = 'full');

create policy "club_memberships_full_delete" on public.club_memberships
  for delete using (private.user_club_access(club_id) = 'full');

-- TEAM_MEMBERSHIPS ----------------------------------------------------
create policy "team_memberships_read" on public.team_memberships
  for select using (
    private.user_team_access(team_id) is not null
    or exists (
      select 1 from public.club_memberships m
      where m.id = team_memberships.membership_id and m.user_id = (select auth.uid())
    )
  );

create policy "team_memberships_full_insert" on public.team_memberships
  for insert with check (
    exists (
      select 1 from public.teams t
      where t.id = team_memberships.team_id
        and private.user_club_access(t.club_id) = 'full'
    )
  );

create policy "team_memberships_full_update" on public.team_memberships
  for update
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

create policy "team_memberships_full_delete" on public.team_memberships
  for delete using (
    exists (
      select 1 from public.teams t
      where t.id = team_memberships.team_id
        and private.user_club_access(t.club_id) = 'full'
    )
  );

-- TEAMS ---------------------------------------------------------------
create policy "teams_member_read" on public.teams
  for select using (private.user_team_access(id) is not null);

create policy "teams_full_insert" on public.teams
  for insert with check (
    private.user_club_access(club_id) = 'full' and private.club_is_active(club_id)
  );

create policy "teams_full_update" on public.teams
  for update
  using      (private.user_club_access(club_id) = 'full' and private.club_is_active(club_id))
  with check (private.user_club_access(club_id) = 'full' and private.club_is_active(club_id));

create policy "teams_full_delete" on public.teams
  for delete using (
    private.user_club_access(club_id) = 'full' and private.club_is_active(club_id)
  );

-- PLAYERS -------------------------------------------------------------
create policy "players_read" on public.players
  for select using (private.user_team_access(team_id) is not null);

create policy "players_insert" on public.players
  for insert with check (
    private.user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from public.teams t where t.id = players.team_id and private.club_is_active(t.club_id))
  );

create policy "players_update" on public.players
  for update
  using (
    private.user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from public.teams t where t.id = players.team_id and private.club_is_active(t.club_id))
  )
  with check (
    private.user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from public.teams t where t.id = players.team_id and private.club_is_active(t.club_id))
  );

create policy "players_delete" on public.players
  for delete using (
    private.user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from public.teams t where t.id = players.team_id and private.club_is_active(t.club_id))
  );

-- SESSIONS ------------------------------------------------------------
create policy "sessions_read" on public.sessions
  for select using (private.user_team_access(team_id) is not null);

create policy "sessions_insert" on public.sessions
  for insert with check (
    private.user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from public.teams t where t.id = sessions.team_id and private.club_is_active(t.club_id))
  );

create policy "sessions_update" on public.sessions
  for update
  using (
    private.user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from public.teams t where t.id = sessions.team_id and private.club_is_active(t.club_id))
  )
  with check (
    private.user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from public.teams t where t.id = sessions.team_id and private.club_is_active(t.club_id))
  );

create policy "sessions_delete" on public.sessions
  for delete using (
    private.user_team_access(team_id) in ('full','extended','team')
    and exists (select 1 from public.teams t where t.id = sessions.team_id and private.club_is_active(t.club_id))
  );

-- SESSION_EXERCISES ---------------------------------------------------
create policy "session_exercises_read" on public.session_exercises
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = session_exercises.session_id
        and private.user_team_access(s.team_id) is not null
    )
  );

create policy "session_exercises_insert" on public.session_exercises
  for insert with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_exercises.session_id
        and private.user_team_access(s.team_id) in ('full','extended','team')
    )
  );

create policy "session_exercises_update" on public.session_exercises
  for update
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

create policy "session_exercises_delete" on public.session_exercises
  for delete using (
    exists (
      select 1 from public.sessions s
      where s.id = session_exercises.session_id
        and private.user_team_access(s.team_id) in ('full','extended','team')
    )
  );

-- SESSION_PREPARATIONS ------------------------------------------------
create policy "session_preparations_read" on public.session_preparations
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = session_preparations.session_id
        and private.user_team_access(s.team_id) is not null
    )
  );

create policy "session_preparations_insert" on public.session_preparations
  for insert with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_preparations.session_id
        and private.user_team_access(s.team_id) in ('full','extended','team')
    )
  );

create policy "session_preparations_update" on public.session_preparations
  for update
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

create policy "session_preparations_delete" on public.session_preparations
  for delete using (
    exists (
      select 1 from public.sessions s
      where s.id = session_preparations.session_id
        and private.user_team_access(s.team_id) in ('full','extended','team')
    )
  );

-- EXERCISES (global library when club_id is null) --------------------
create policy "exercises_read" on public.exercises
  for select using (
    club_id is null
    or private.user_club_access(club_id) is not null
  );

create policy "exercises_insert" on public.exercises
  for insert with check (
    club_id is not null
    and private.user_club_access(club_id) in ('full','extended','team')
  );

create policy "exercises_update" on public.exercises
  for update
  using (
    club_id is not null
    and private.user_club_access(club_id) in ('full','extended','team')
  )
  with check (
    club_id is not null
    and private.user_club_access(club_id) in ('full','extended','team')
  );

create policy "exercises_delete" on public.exercises
  for delete using (
    club_id is not null
    and private.user_club_access(club_id) in ('full','extended','team')
  );

-- MACROCYCLES ---------------------------------------------------------
create policy "macrocycles_read" on public.macrocycles
  for select using (private.user_team_access(team_id) is not null);

create policy "macrocycles_insert" on public.macrocycles
  for insert with check (private.user_team_access(team_id) in ('full','extended','team'));

create policy "macrocycles_update" on public.macrocycles
  for update
  using      (private.user_team_access(team_id) in ('full','extended','team'))
  with check (private.user_team_access(team_id) in ('full','extended','team'));

create policy "macrocycles_delete" on public.macrocycles
  for delete using (private.user_team_access(team_id) in ('full','extended','team'));

-- MESOCYCLES ----------------------------------------------------------
create policy "mesocycles_read" on public.mesocycles
  for select using (
    exists (
      select 1 from public.macrocycles m
      where m.id = mesocycles.macrocycle_id and private.user_team_access(m.team_id) is not null
    )
  );

create policy "mesocycles_insert" on public.mesocycles
  for insert with check (
    exists (
      select 1 from public.macrocycles m
      where m.id = mesocycles.macrocycle_id
        and private.user_team_access(m.team_id) in ('full','extended','team')
    )
  );

create policy "mesocycles_update" on public.mesocycles
  for update
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

create policy "mesocycles_delete" on public.mesocycles
  for delete using (
    exists (
      select 1 from public.macrocycles m
      where m.id = mesocycles.macrocycle_id
        and private.user_team_access(m.team_id) in ('full','extended','team')
    )
  );

-- MICROCYCLES ---------------------------------------------------------
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

create policy "microcycles_insert" on public.microcycles
  for insert with check (
    exists (
      select 1
      from public.mesocycles me
      join public.macrocycles ma on ma.id = me.macrocycle_id
      where me.id = microcycles.mesocycle_id
        and private.user_team_access(ma.team_id) in ('full','extended','team')
    )
  );

create policy "microcycles_update" on public.microcycles
  for update
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

create policy "microcycles_delete" on public.microcycles
  for delete using (
    exists (
      select 1
      from public.mesocycles me
      join public.macrocycles ma on ma.id = me.macrocycle_id
      where me.id = microcycles.mesocycle_id
        and private.user_team_access(ma.team_id) in ('full','extended','team')
    )
  );

-- CLUB_INVITATIONS ----------------------------------------------------
create policy "invitations_admin_read" on public.club_invitations
  for select using (private.user_club_access(club_id) in ('full','extended'));

create policy "invitations_full_insert" on public.club_invitations
  for insert with check (private.user_club_access(club_id) = 'full');

create policy "invitations_full_update" on public.club_invitations
  for update
  using      (private.user_club_access(club_id) = 'full')
  with check (private.user_club_access(club_id) = 'full');

create policy "invitations_full_delete" on public.club_invitations
  for delete using (private.user_club_access(club_id) = 'full');

-- BILLING_EVENTS (read-only by full members; writes via service role) -
create policy "billing_events_full_read" on public.billing_events
  for select using (private.user_club_access(club_id) = 'full');
