-- Issue #36 — RLS contingent club-scoped (EPIC #34 Gestion du contingent)
--
-- Après #35, un joueur peut exister sans `team_id` (rattaché au club via
-- `club_id`). Les anciennes policies basées sur `private.user_team_access(team_id)`
-- rendaient ces fiches inaccessibles. On bascule `players` et
-- `player_team_assignments` sur un modèle **club-scoped** via
-- `private.user_club_access(club_id)` (+ `private.club_is_active`).
--
-- Sémantique d'accès conservée :
--   lecture  = membre du club (access_level non NULL)
--   écriture = full / extended / team  (comme l'ancien modèle players)

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. players : club-scoped
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS players_read   ON public.players;
DROP POLICY IF EXISTS players_insert ON public.players;
DROP POLICY IF EXISTS players_update ON public.players;
DROP POLICY IF EXISTS players_delete ON public.players;

CREATE POLICY players_read
  ON public.players FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

CREATE POLICY players_insert
  ON public.players FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY players_update
  ON public.players FOR UPDATE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY players_delete
  ON public.players FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

-- ---------------------------------------------------------------------------
-- 2. player_team_assignments : club-scoped via le club du joueur
--    (remplace les policies team-scoped posées en #35)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS player_team_assignments_read   ON public.player_team_assignments;
DROP POLICY IF EXISTS player_team_assignments_insert ON public.player_team_assignments;
DROP POLICY IF EXISTS player_team_assignments_update ON public.player_team_assignments;
DROP POLICY IF EXISTS player_team_assignments_delete ON public.player_team_assignments;

CREATE POLICY player_team_assignments_read
  ON public.player_team_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.players p
     WHERE p.id = player_team_assignments.player_id
       AND private.user_club_access(p.club_id) IS NOT NULL
  ));

CREATE POLICY player_team_assignments_insert
  ON public.player_team_assignments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.players p
     WHERE p.id = player_team_assignments.player_id
       AND private.user_club_access(p.club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])
       AND private.club_is_active(p.club_id)
  ));

CREATE POLICY player_team_assignments_update
  ON public.player_team_assignments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.players p
     WHERE p.id = player_team_assignments.player_id
       AND private.user_club_access(p.club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])
       AND private.club_is_active(p.club_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.players p
     WHERE p.id = player_team_assignments.player_id
       AND private.user_club_access(p.club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])
       AND private.club_is_active(p.club_id)
  ));

CREATE POLICY player_team_assignments_delete
  ON public.player_team_assignments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.players p
     WHERE p.id = player_team_assignments.player_id
       AND private.user_club_access(p.club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])
       AND private.club_is_active(p.club_id)
  ));

COMMIT;
