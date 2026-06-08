-- Saison vierge + import — Migration A : appartenance équipe ↔ saison
--
-- Jusqu'ici la liste des équipes n'était PAS filtrée par saison : les mêmes
-- équipes apparaissaient dans tous les millésimes. On veut désormais qu'une
-- nouvelle saison démarre VIERGE (équipes comprises), tout en gardant un
-- `team.id` STABLE à travers les saisons (cohérent avec l'estampillage déjà en
-- place sur player_team_assignments.season et season_plans.season_label).
--
-- Mécanique : une table d'appartenance légère. Une équipe est visible dans une
-- saison SSI elle possède une ligne `team_seasons`. L'import de saison se borne
-- alors à insérer des lignes ici (+ copier les données estampillées par saison).
--
-- RLS calquée sur season_plans / team_periodization_settings (club-scoped).

BEGIN;

CREATE TABLE IF NOT EXISTS public.team_seasons (
    team_id    uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    season     text NOT NULL,
    club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT team_seasons_pkey PRIMARY KEY (team_id, season),
    CONSTRAINT team_seasons_label_format CHECK (season ~ '^\d{4}/\d{2}$')
);

CREATE INDEX IF NOT EXISTS team_seasons_club_season_idx
  ON public.team_seasons USING btree (club_id, season);

-- ---------------------------------------------------------------------------
-- Backfill : ne RIEN faire disparaître. On déduit les couples (équipe, saison)
-- de toutes les sources estampillées existantes, + fallback saison courante
-- (bascule au 1er juillet) pour les équipes actives sans saison déduite.
-- ---------------------------------------------------------------------------
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
),
derived AS (
  -- saison portée par la colonne teams.season (legacy)
  SELECT t.id AS team_id, t.club_id, t.season AS season
    FROM public.teams t
   WHERE t.season ~ '^\d{4}/\d{2}$'
  UNION
  -- saisons présentes sur les affectations joueurs
  SELECT t.id, t.club_id, a.season
    FROM public.player_team_assignments a
    JOIN public.teams t ON t.id = a.team_id
   WHERE a.season ~ '^\d{4}/\d{2}$'
  UNION
  -- saisons présentes sur les plans
  SELECT t.id, t.club_id, p.season_label
    FROM public.season_plans p
    JOIN public.teams t ON t.id = p.team_id
   WHERE p.season_label ~ '^\d{4}/\d{2}$'
  UNION
  -- fallback : équipes actives n'ayant AUCUNE saison déduite → saison courante
  SELECT t.id, t.club_id, (SELECT label FROM current_label)
    FROM public.teams t
   WHERE t.archived_at IS NULL
     AND NOT (t.season ~ '^\d{4}/\d{2}$')
     AND NOT EXISTS (
       SELECT 1 FROM public.player_team_assignments a
        WHERE a.team_id = t.id AND a.season ~ '^\d{4}/\d{2}$'
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.season_plans p
        WHERE p.team_id = t.id AND p.season_label ~ '^\d{4}/\d{2}$'
     )
)
INSERT INTO public.team_seasons (team_id, season, club_id)
SELECT team_id, season, club_id FROM derived
ON CONFLICT (team_id, season) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_seasons_read   ON public.team_seasons;
DROP POLICY IF EXISTS team_seasons_insert ON public.team_seasons;
DROP POLICY IF EXISTS team_seasons_delete ON public.team_seasons;

CREATE POLICY team_seasons_read
  ON public.team_seasons FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

CREATE POLICY team_seasons_insert
  ON public.team_seasons FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY team_seasons_delete
  ON public.team_seasons FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

GRANT ALL ON TABLE public.team_seasons TO anon;
GRANT ALL ON TABLE public.team_seasons TO authenticated;
GRANT ALL ON TABLE public.team_seasons TO service_role;

COMMIT;
