-- =====================================================================
-- 0017 — Free solo path (no club required)
-- =====================================================================
-- The free tier means the user has NO row in club_memberships.
-- They can still:
--   * Create a single "scratch" session (sessions.team_id NULL,
--     trainer_id = auth.uid())
--   * Create their own private exercises (club_id NULL,
--     trainer_id = auth.uid())
--   * Read the seeded library (exercises with trainer_id NULL)
--
-- All RLS policies gain a "free-solo branch" so the same checks work
-- whether the user is solo or club-affiliated. Club rows stay locked
-- via private.user_club_access / private.user_team_access as before.
--
-- IMPORTANT: the existing exercises_read policy used "club_id IS NULL"
-- as a proxy for system library, which would have leaked personal
-- free-user exercises to everyone. We tighten that: library = trainer_id
-- IS NULL, personal-free = club_id IS NULL AND trainer_id = auth.uid().
-- =====================================================================

-- ---------------------------------------------------------------------
-- sessions.team_id becomes nullable for the solo-scratch wizard
-- ---------------------------------------------------------------------
alter table sessions alter column team_id drop not null;

-- ---------------------------------------------------------------------
-- exercises: tighten SELECT (library vs personal) and add free branch
-- ---------------------------------------------------------------------
drop policy if exists "exercises_read"   on exercises;
drop policy if exists "exercises_insert" on exercises;
drop policy if exists "exercises_update" on exercises;
drop policy if exists "exercises_delete" on exercises;

create policy "exercises_read" on exercises
  for select using (
    -- 1) Seeded library (no owner, no club) → readable by any auth user.
    (trainer_id is null and club_id is null)
    -- 2) Premium club exercises → club access required.
    or (club_id is not null and private.user_club_access(club_id) is not null)
    -- 3) Free-solo personal exercises → owner only.
    or (club_id is null and trainer_id is not null
        and trainer_id = (select auth.uid()))
  );

create policy "exercises_insert" on exercises
  for insert with check (
    (club_id is not null
     and private.user_club_access(club_id) = any (array['full','extended','team']::access_level[]))
    or (club_id is null and trainer_id = (select auth.uid()))
  );

create policy "exercises_update" on exercises
  for update using (
    (club_id is not null
     and private.user_club_access(club_id) = any (array['full','extended','team']::access_level[]))
    or (club_id is null and trainer_id = (select auth.uid()))
  ) with check (
    (club_id is not null
     and private.user_club_access(club_id) = any (array['full','extended','team']::access_level[]))
    or (club_id is null and trainer_id = (select auth.uid()))
  );

create policy "exercises_delete" on exercises
  for delete using (
    (club_id is not null
     and private.user_club_access(club_id) = any (array['full','extended','team']::access_level[]))
    or (club_id is null and trainer_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------
-- sessions: add free-solo branch (team_id NULL, owner = caller)
-- ---------------------------------------------------------------------
drop policy if exists "sessions_read"   on sessions;
drop policy if exists "sessions_insert" on sessions;
drop policy if exists "sessions_update" on sessions;
drop policy if exists "sessions_delete" on sessions;

create policy "sessions_read" on sessions
  for select using (
    private.user_team_access(team_id) is not null
    or (team_id is null and trainer_id = (select auth.uid()))
  );

create policy "sessions_insert" on sessions
  for insert with check (
    (
      private.user_team_access(team_id) = any (array['full','extended','team']::access_level[])
      and exists (
        select 1 from teams t
        where t.id = sessions.team_id
          and private.club_is_active(t.club_id)
      )
    )
    or (team_id is null and trainer_id = (select auth.uid()))
  );

create policy "sessions_update" on sessions
  for update using (
    (
      private.user_team_access(team_id) = any (array['full','extended','team']::access_level[])
      and exists (
        select 1 from teams t
        where t.id = sessions.team_id
          and private.club_is_active(t.club_id)
      )
    )
    or (team_id is null and trainer_id = (select auth.uid()))
  ) with check (
    (
      private.user_team_access(team_id) = any (array['full','extended','team']::access_level[])
      and exists (
        select 1 from teams t
        where t.id = sessions.team_id
          and private.club_is_active(t.club_id)
      )
    )
    or (team_id is null and trainer_id = (select auth.uid()))
  );

create policy "sessions_delete" on sessions
  for delete using (
    (
      private.user_team_access(team_id) = any (array['full','extended','team']::access_level[])
      and exists (
        select 1 from teams t
        where t.id = sessions.team_id
          and private.club_is_active(t.club_id)
      )
    )
    or (team_id is null and trainer_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------
-- session_exercises: inherit the new sessions branch via EXISTS
-- ---------------------------------------------------------------------
drop policy if exists "session_exercises_read"   on session_exercises;
drop policy if exists "session_exercises_insert" on session_exercises;
drop policy if exists "session_exercises_update" on session_exercises;
drop policy if exists "session_exercises_delete" on session_exercises;

create policy "session_exercises_read" on session_exercises
  for select using (
    exists (
      select 1 from sessions s
      where s.id = session_exercises.session_id
        and (
          private.user_team_access(s.team_id) is not null
          or (s.team_id is null and s.trainer_id = (select auth.uid()))
        )
    )
  );

create policy "session_exercises_insert" on session_exercises
  for insert with check (
    exists (
      select 1 from sessions s
      where s.id = session_exercises.session_id
        and (
          private.user_team_access(s.team_id)
            = any (array['full','extended','team']::access_level[])
          or (s.team_id is null and s.trainer_id = (select auth.uid()))
        )
    )
  );

create policy "session_exercises_update" on session_exercises
  for update using (
    exists (
      select 1 from sessions s
      where s.id = session_exercises.session_id
        and (
          private.user_team_access(s.team_id)
            = any (array['full','extended','team']::access_level[])
          or (s.team_id is null and s.trainer_id = (select auth.uid()))
        )
    )
  ) with check (
    exists (
      select 1 from sessions s
      where s.id = session_exercises.session_id
        and (
          private.user_team_access(s.team_id)
            = any (array['full','extended','team']::access_level[])
          or (s.team_id is null and s.trainer_id = (select auth.uid()))
        )
    )
  );

create policy "session_exercises_delete" on session_exercises
  for delete using (
    exists (
      select 1 from sessions s
      where s.id = session_exercises.session_id
        and (
          private.user_team_access(s.team_id)
            = any (array['full','extended','team']::access_level[])
          or (s.team_id is null and s.trainer_id = (select auth.uid()))
        )
    )
  );

-- ---------------------------------------------------------------------
-- session_preparations: same pattern
-- ---------------------------------------------------------------------
drop policy if exists "session_preparations_read"   on session_preparations;
drop policy if exists "session_preparations_insert" on session_preparations;
drop policy if exists "session_preparations_update" on session_preparations;
drop policy if exists "session_preparations_delete" on session_preparations;

create policy "session_preparations_read" on session_preparations
  for select using (
    exists (
      select 1 from sessions s
      where s.id = session_preparations.session_id
        and (
          private.user_team_access(s.team_id) is not null
          or (s.team_id is null and s.trainer_id = (select auth.uid()))
        )
    )
  );

create policy "session_preparations_insert" on session_preparations
  for insert with check (
    exists (
      select 1 from sessions s
      where s.id = session_preparations.session_id
        and (
          private.user_team_access(s.team_id)
            = any (array['full','extended','team']::access_level[])
          or (s.team_id is null and s.trainer_id = (select auth.uid()))
        )
    )
  );

create policy "session_preparations_update" on session_preparations
  for update using (
    exists (
      select 1 from sessions s
      where s.id = session_preparations.session_id
        and (
          private.user_team_access(s.team_id)
            = any (array['full','extended','team']::access_level[])
          or (s.team_id is null and s.trainer_id = (select auth.uid()))
        )
    )
  ) with check (
    exists (
      select 1 from sessions s
      where s.id = session_preparations.session_id
        and (
          private.user_team_access(s.team_id)
            = any (array['full','extended','team']::access_level[])
          or (s.team_id is null and s.trainer_id = (select auth.uid()))
        )
    )
  );

create policy "session_preparations_delete" on session_preparations
  for delete using (
    exists (
      select 1 from sessions s
      where s.id = session_preparations.session_id
        and (
          private.user_team_access(s.team_id)
            = any (array['full','extended','team']::access_level[])
          or (s.team_id is null and s.trainer_id = (select auth.uid()))
        )
    )
  );

-- ---------------------------------------------------------------------
-- Covering index for the free-solo lookup paths
-- ---------------------------------------------------------------------
create index if not exists sessions_solo_idx
  on sessions (trainer_id) where team_id is null;

create index if not exists exercises_solo_idx
  on exercises (trainer_id) where club_id is null and trainer_id is not null;
