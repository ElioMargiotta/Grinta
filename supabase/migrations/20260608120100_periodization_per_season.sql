-- Saison vierge + import — Migration B : périodisation PAR SAISON
--
-- team_periodization_settings avait pour clé primaire `team_id` seul : une seule
-- config de rythme par équipe, PARTAGÉE entre saisons. Or on veut qu'une saison
-- vierge démarre sans réglages, et qu'on puisse les IMPORTER d'une autre saison.
-- On ajoute donc la dimension saison (PK = team_id + season).

BEGIN;

ALTER TABLE public.team_periodization_settings
  ADD COLUMN IF NOT EXISTS season text;

-- Backfill : rattache la config existante à la saison de l'équipe (teams.season)
-- ou, à défaut, à la saison courante (bascule au 1er juillet).
WITH current_season AS (
  SELECT (
    CASE WHEN extract(month FROM now()) >= 7
      THEN extract(year FROM now())::int
      ELSE extract(year FROM now())::int - 1
    END
  ) AS start_year
),
current_label AS (
  SELECT start_year::text || '/' || lpad(((start_year + 1) % 100)::text, 2, '0') AS label
    FROM current_season
)
UPDATE public.team_periodization_settings s
   SET season = COALESCE(
     CASE WHEN t.season ~ '^\d{4}/\d{2}$' THEN t.season END,
     (SELECT label FROM current_label)
   )
  FROM public.teams t
 WHERE t.id = s.team_id
   AND s.season IS NULL;

-- Sécurité : toute ligne encore NULL (équipe absente, improbable) → saison courante.
WITH current_season AS (
  SELECT (
    CASE WHEN extract(month FROM now()) >= 7
      THEN extract(year FROM now())::int
      ELSE extract(year FROM now())::int - 1
    END
  ) AS start_year
),
current_label AS (
  SELECT start_year::text || '/' || lpad(((start_year + 1) % 100)::text, 2, '0') AS label
    FROM current_season
)
UPDATE public.team_periodization_settings
   SET season = (SELECT label FROM current_label)
 WHERE season IS NULL;

ALTER TABLE public.team_periodization_settings
  ALTER COLUMN season SET NOT NULL;

ALTER TABLE public.team_periodization_settings
  ADD CONSTRAINT team_periodization_settings_season_format
  CHECK (season ~ '^\d{4}/\d{2}$');

-- Bascule la PK de (team_id) vers (team_id, season).
ALTER TABLE public.team_periodization_settings
  DROP CONSTRAINT IF EXISTS team_periodization_settings_pkey;
ALTER TABLE public.team_periodization_settings
  ADD CONSTRAINT team_periodization_settings_pkey PRIMARY KEY (team_id, season);

COMMIT;
