-- Index sur les clés étrangères non couvertes (issue #88).
--
-- Pourquoi : une FK sans index sur sa colonne de référence force Postgres à
-- scanner toute la table enfant lors d'un join sur la FK, et — surtout — lors
-- d'un DELETE/UPDATE sur la ligne parente (vérification ON DELETE CASCADE /
-- SET NULL / RESTRICT), ce qui pose des locks et dégrade les perfs à mesure
-- que les tables grossissent.
--
-- Liste établie en interrogeant pg_constraint vs pg_index sur la DEV COPY :
-- 12 FK sans index couvrant. Toutes sont des btree sur la colonne de la FK.
-- Idempotent (IF NOT EXISTS), conforme aux conventions du repo.

BEGIN;

CREATE INDEX IF NOT EXISTS club_invitations_role_id_idx
  ON public.club_invitations (role_id);

CREATE INDEX IF NOT EXISTS club_invitations_team_id_idx
  ON public.club_invitations (team_id);

CREATE INDEX IF NOT EXISTS physical_measurements_club_id_idx
  ON public.physical_measurements (club_id);

CREATE INDEX IF NOT EXISTS physical_measurements_recorded_by_idx
  ON public.physical_measurements (recorded_by);

CREATE INDEX IF NOT EXISTS physical_metrics_created_by_idx
  ON public.physical_metrics (created_by);

CREATE INDEX IF NOT EXISTS player_evaluations_created_by_idx
  ON public.player_evaluations (created_by);

CREATE INDEX IF NOT EXISTS session_attendances_actual_marked_by_idx
  ON public.session_attendances (actual_marked_by);

CREATE INDEX IF NOT EXISTS session_physical_tests_club_id_idx
  ON public.session_physical_tests (club_id);

CREATE INDEX IF NOT EXISTS session_physical_tests_created_by_idx
  ON public.session_physical_tests (created_by);

CREATE INDEX IF NOT EXISTS session_physical_tests_metric_id_idx
  ON public.session_physical_tests (metric_id);

CREATE INDEX IF NOT EXISTS team_calendar_subscriptions_created_by_idx
  ON public.team_calendar_subscriptions (created_by);

CREATE INDEX IF NOT EXISTS team_matches_microcycle_id_idx
  ON public.team_matches (microcycle_id);

COMMIT;
