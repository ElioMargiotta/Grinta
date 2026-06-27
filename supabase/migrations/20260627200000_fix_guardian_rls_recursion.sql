-- HOTFIX — récursion infinie RLS players <-> player_guardians (introduite par
-- 20260627170100 + 20260627190000).
--
-- Bug : la policy players_read_guardian (sur players) faisait EXISTS sur
-- player_guardians, dont la policy player_guardians_read_self faisait EXISTS sur
-- players → boucle infinie ("infinite recursion detected in policy for relation
-- players"). Toute lecture de players échouait, rendant vides/cassés contingent,
-- équipes, planning, systèmes de jeu (tous joignent players).
--
-- Correctif : router les références CROISÉES entre ces deux tables par des
-- fonctions SECURITY DEFINER (private.*) qui contournent la RLS — exactement le
-- patron déjà utilisé par private.user_club_access / private.player_club_id.
-- AUCUNE donnée n'est touchée : on ne fait que remplacer des policies.

BEGIN;

-- ---------------------------------------------------------------------------
-- Helpers SECURITY DEFINER : évaluent l'appartenance sans déclencher la RLS de
-- la table lue (donc sans ré-entrer dans la policy appelante).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.user_is_guardian_of(p_player_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.player_guardians g
     WHERE g.player_id = p_player_id
       AND g.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION private.user_is_self_of_player(p_player_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players p
     WHERE p.id = p_player_id
       AND p.user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION private.user_is_guardian_of(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_is_self_of_player(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.user_is_guardian_of(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.user_is_self_of_player(uuid) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- players : lecture tuteur via helper DEFINER (ne ré-entre plus dans la RLS de
-- player_guardians) → casse la boucle côté players.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS players_read_guardian ON public.players;
CREATE POLICY players_read_guardian
  ON public.players FOR SELECT
  USING (private.user_is_guardian_of(id));

-- ---------------------------------------------------------------------------
-- player_guardians : lecture self via helper DEFINER (ne ré-entre plus dans la
-- RLS de players) → casse la boucle côté player_guardians.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS player_guardians_read_self ON public.player_guardians;
CREATE POLICY player_guardians_read_self
  ON public.player_guardians FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR private.user_is_self_of_player(player_id)
  );

-- ---------------------------------------------------------------------------
-- player_team_assignments : même précaution (lecture tuteur via helper), pour
-- éviter toute ré-entrée transitive players <-> player_guardians.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS player_team_assignments_read_guardian ON public.player_team_assignments;
CREATE POLICY player_team_assignments_read_guardian
  ON public.player_team_assignments FOR SELECT
  USING (private.user_is_guardian_of(player_id));

COMMIT;

NOTIFY pgrst, 'reload schema';
