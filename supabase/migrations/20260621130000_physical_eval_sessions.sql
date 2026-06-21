-- Évaluations physiques sur le planning
--
-- Une « éval physique » est une instance posée sur le planning d'une équipe à
-- une date, qui regroupe un ou plusieurs tests physiques/techniques (cf.
-- physical_metrics / session_physical_tests). Elle réutilise la table
-- `sessions` mais N'EST PAS un entraînement :
--   * `kind = 'physical_eval'` la distingue (défaut 'training' pour l'existant) ;
--   * au plus 1 éval par équipe et par jour (index unique partiel) ;
--   * exclue des comptages d'entraînement côté planner (filtre applicatif).
--
-- Forward-only et idempotent.

BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'training';

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_kind_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_kind_check
  CHECK (kind IN ('training', 'physical_eval'));

-- 1 éval physique max par équipe et par jour (les entraînements gardent leurs
-- deux créneaux matin/après-midi, hors de cette contrainte).
DROP INDEX IF EXISTS public.sessions_one_eval_per_day;
CREATE UNIQUE INDEX sessions_one_eval_per_day
  ON public.sessions (team_id, date)
  WHERE kind = 'physical_eval';

COMMIT;
