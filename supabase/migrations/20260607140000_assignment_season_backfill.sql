-- Saisons claires à tous les niveaux : les affectations joueur↔équipe sont
-- désormais ESTAMPILLÉES par saison (player_team_assignments.season) pour offrir
-- une vue d'ensemble du club PAR saison (équipes, contingent, planif).
--
-- Historique : les affectations « courantes » étaient stockées avec season = NULL
-- (roster unique, saison-agnostique). On les rattache à la saison de leur équipe
-- (teams.season, millésime `YYYY/YY`). Le code applicatif écrit désormais la
-- saison active à chaque nouvelle affectation.
--
-- Idempotent : ne touche que les lignes encore à NULL dont l'équipe a un
-- millésime valide. Les rares affectations dont l'équipe n'a pas de saison
-- valable restent à NULL (legacy) et n'apparaissent dans aucune saison précise.

BEGIN;

UPDATE public.player_team_assignments a
   SET season = t.season
  FROM public.teams t
 WHERE t.id = a.team_id
   AND a.season IS NULL
   AND t.season ~ '^\d{4}/\d{2}$';

COMMIT;
