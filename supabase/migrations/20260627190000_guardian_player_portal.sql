-- Lot E — Portail joueur/parent multi-clubs.
--
-- Un parent/tuteur (player_guardians) doit pouvoir CONSULTER la fiche de son
-- enfant comme le joueur consulte la sienne (lecture seule). On ajoute des
-- policies SELECT "guardian" en miroir des policies "self" de #47/sharing
-- (Postgres combine les policies en OR — aucune écriture n'est ouverte).
--
-- + RPC my_linked_players() : liste TOUTES les fiches liées au compte courant
-- (self ∪ guardian), tous clubs confondus, pour le sélecteur de profil du
-- portail (double passeport, fratrie). SECURITY DEFINER mais ne renvoie que les
-- lignes rattachées à auth.uid() — aucune fuite cross-compte.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. players : le tuteur lit la fiche de son enfant
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS players_read_guardian ON public.players;
CREATE POLICY players_read_guardian
  ON public.players FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.player_guardians g
     WHERE g.player_id = players.id
       AND g.user_id = (SELECT auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 2. player_team_assignments : affectations de l'enfant
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS player_team_assignments_read_guardian ON public.player_team_assignments;
CREATE POLICY player_team_assignments_read_guardian
  ON public.player_team_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.player_guardians g
     WHERE g.player_id = player_team_assignments.player_id
       AND g.user_id = (SELECT auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 3. teams : équipes où l'enfant est affecté
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS teams_guardian_read ON public.teams;
CREATE POLICY teams_guardian_read
  ON public.teams FOR SELECT
  USING (EXISTS (
    SELECT 1
      FROM public.player_team_assignments pta
      JOIN public.player_guardians g ON g.player_id = pta.player_id
     WHERE pta.team_id = teams.id
       AND g.user_id = (SELECT auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 4. sessions : séances des équipes de l'enfant
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sessions_guardian_read ON public.sessions;
CREATE POLICY sessions_guardian_read
  ON public.sessions FOR SELECT
  USING (EXISTS (
    SELECT 1
      FROM public.player_team_assignments pta
      JOIN public.player_guardians g ON g.player_id = pta.player_id
     WHERE pta.team_id = sessions.team_id
       AND g.user_id = (SELECT auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 5. player_evaluations : évaluations PARTAGÉES de l'enfant
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS player_evaluations_read_guardian ON public.player_evaluations;
CREATE POLICY player_evaluations_read_guardian
  ON public.player_evaluations FOR SELECT
  USING (
    shared_with_player = true
    AND EXISTS (
      SELECT 1 FROM public.player_guardians g
       WHERE g.player_id = player_evaluations.player_id
         AND g.user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 6. RPC my_linked_players : toutes les fiches liées au compte (self ∪ guardian)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_linked_players()
  RETURNS TABLE (
    player_id  uuid,
    club_id    uuid,
    club_name  text,
    first_name text,
    last_name  text,
    relation   text,
    status     text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT p.id, p.club_id, c.name, p.first_name, p.last_name, 'self'::text, p.status
    FROM public.players p
    JOIN public.clubs c ON c.id = p.club_id
   WHERE p.user_id = auth.uid()
  UNION
  SELECT p.id, p.club_id, c.name, p.first_name, p.last_name, 'guardian'::text, p.status
    FROM public.player_guardians g
    JOIN public.players p ON p.id = g.player_id
    JOIN public.clubs c   ON c.id = p.club_id
   WHERE g.user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.my_linked_players() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_linked_players() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
