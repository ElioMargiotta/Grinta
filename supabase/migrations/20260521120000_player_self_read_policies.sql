-- Issue #47 — Profil adaptable joueur/entraîneur (double identité)
--
-- Après #35 le pont `players.user_id` permet à un compte d'avoir une
-- fiche joueur (avec ou sans membership staff). Les policies club-scoped
-- de #36 (private.user_club_access) bloquent un compte purement-joueur :
-- il ne peut lire ni sa propre fiche, ni ses affectations, ni les équipes
-- où il est inscrit, ni les séances de ces équipes.
--
-- On ajoute des policies SELECT "self" complémentaires (Postgres combine
-- plusieurs policies en OR), sans modifier les écritures — le staff reste
-- la seule entrée d'édition (lecture seule côté vue joueur, cf. #47 scope).
--
-- Tables couvertes :
--   players                   → players_read_self
--   player_team_assignments   → player_team_assignments_read_self
--   teams                     → teams_player_read
--   sessions                  → sessions_player_read

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. players : le compte lié peut lire sa propre fiche
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS players_read_self ON public.players;

CREATE POLICY players_read_self
  ON public.players FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. player_team_assignments : le joueur peut lire ses propres affectations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS player_team_assignments_read_self ON public.player_team_assignments;

CREATE POLICY player_team_assignments_read_self
  ON public.player_team_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.players p
     WHERE p.id = player_team_assignments.player_id
       AND p.user_id = (SELECT auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 3. teams : le joueur peut lire les équipes où il est affecté
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS teams_player_read ON public.teams;

CREATE POLICY teams_player_read
  ON public.teams FOR SELECT
  USING (EXISTS (
    SELECT 1
      FROM public.player_team_assignments pta
      JOIN public.players p ON p.id = pta.player_id
     WHERE pta.team_id = teams.id
       AND p.user_id = (SELECT auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 4. sessions : le joueur peut lire les séances des équipes où il joue
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sessions_player_read ON public.sessions;

CREATE POLICY sessions_player_read
  ON public.sessions FOR SELECT
  USING (EXISTS (
    SELECT 1
      FROM public.player_team_assignments pta
      JOIN public.players p ON p.id = pta.player_id
     WHERE pta.team_id = sessions.team_id
       AND p.user_id = (SELECT auth.uid())
  ));

COMMIT;
