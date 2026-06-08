-- Lot 1 / refonte planning piloté par les matchs — Migration A
--
-- `team_matches` (créée en #61/#75 comme simple cache de l'ICS) devient la
-- couche d'ancrage ÉDITABLE de la périodisation :
--   * kind          : nature de l'événement (league/cup/friendly/tournament/break)
--   * home_away      : domicile / extérieur (dérivable du SUMMARY football.ch)
--   * opponent       : adversaire (best-effort depuis le SUMMARY, éditable plus tard)
--   * competition    : libellé de compétition
--   * is_anchor      : ce match structure-t-il la saison ? (un amical peut être
--                      décoché pour ne pas couper le microcycle)
--   * microcycle_id  : le microcycle (semaine d'entraînement) qui prépare ce match
--
-- On étend aussi `source` pour accepter les matchs saisis à la main ('manual').

BEGIN;

ALTER TABLE public.team_matches
  ADD COLUMN IF NOT EXISTS kind         text NOT NULL DEFAULT 'league',
  ADD COLUMN IF NOT EXISTS home_away    text,
  ADD COLUMN IF NOT EXISTS opponent     text,
  ADD COLUMN IF NOT EXISTS competition  text,
  ADD COLUMN IF NOT EXISTS is_anchor    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS microcycle_id uuid;

-- CHECK contraintes (ajoutées séparément pour rester idempotent / lisible).
ALTER TABLE public.team_matches
  DROP CONSTRAINT IF EXISTS team_matches_kind_values;
ALTER TABLE public.team_matches
  ADD CONSTRAINT team_matches_kind_values CHECK (
    kind IN ('league', 'cup', 'friendly', 'tournament', 'break')
  );

ALTER TABLE public.team_matches
  DROP CONSTRAINT IF EXISTS team_matches_home_away_values;
ALTER TABLE public.team_matches
  ADD CONSTRAINT team_matches_home_away_values CHECK (
    home_away IS NULL OR home_away IN ('home', 'away')
  );

ALTER TABLE public.team_matches
  DROP CONSTRAINT IF EXISTS team_matches_opponent_length;
ALTER TABLE public.team_matches
  ADD CONSTRAINT team_matches_opponent_length CHECK (
    opponent IS NULL OR length(opponent) <= 200
  );

ALTER TABLE public.team_matches
  DROP CONSTRAINT IF EXISTS team_matches_competition_length;
ALTER TABLE public.team_matches
  ADD CONSTRAINT team_matches_competition_length CHECK (
    competition IS NULL OR length(competition) <= 200
  );

-- Étendre la liste des sources : 'manual' = match saisi dans l'UI (Lot 2).
ALTER TABLE public.team_matches
  DROP CONSTRAINT IF EXISTS team_matches_source_values;
ALTER TABLE public.team_matches
  ADD CONSTRAINT team_matches_source_values CHECK (
    source IN ('subscription', 'upload', 'manual')
  );

-- FK vers microcycles. ON DELETE SET NULL : supprimer un microcycle (re-génération)
-- ne doit pas effacer le match officiel importé.
ALTER TABLE public.team_matches
  DROP CONSTRAINT IF EXISTS team_matches_microcycle_fkey;
ALTER TABLE public.team_matches
  ADD CONSTRAINT team_matches_microcycle_fkey
    FOREIGN KEY (microcycle_id) REFERENCES public.microcycles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS team_matches_anchor_idx
  ON public.team_matches USING btree (team_id, is_anchor, starts_at);

COMMIT;
