-- Lot 1 / refonte planning piloté par les matchs — Migration B
--
-- Config du rythme de périodisation PAR ÉQUIPE (les catégories ont des rythmes
-- différents : 1 match/we en junior, milieu de semaine en coupe, etc.). Le
-- générateur (`planSeason`) lit cette table pour savoir quels jours placer les
-- entraînements et quel schéma MD- appliquer.
--
--   * training_weekdays : jours d'entraînement, ISO 1=lundi … 7=dimanche.
--   * md_scheme         : 'standard' (1 match/sem) | 'congested' (2 matchs/sem)
--                         | 'custom'.
--
-- RLS calquée sur team_calendar_subscriptions (club-scoped).

BEGIN;

CREATE TABLE IF NOT EXISTS public.team_periodization_settings (
    team_id           uuid NOT NULL,
    club_id           uuid NOT NULL,
    training_weekdays smallint[] NOT NULL DEFAULT '{2,4}',
    md_scheme         text NOT NULL DEFAULT 'standard',
    created_at        timestamp with time zone NOT NULL DEFAULT now(),
    updated_at        timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT team_periodization_settings_pkey PRIMARY KEY (team_id),
    CONSTRAINT team_periodization_settings_team_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    CONSTRAINT team_periodization_settings_club_fkey
      FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE,
    CONSTRAINT team_periodization_settings_scheme_values CHECK (
      md_scheme IN ('standard', 'congested', 'custom')
    ),
    CONSTRAINT team_periodization_settings_weekdays_bounds CHECK (
      array_length(training_weekdays, 1) IS NULL
      OR (
        array_length(training_weekdays, 1) BETWEEN 1 AND 7
        AND training_weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
      )
    )
);

CREATE INDEX IF NOT EXISTS team_periodization_settings_club_idx
  ON public.team_periodization_settings USING btree (club_id);

-- Réutilise la fonction trigger créée par la migration calendar (#61).
DROP TRIGGER IF EXISTS team_periodization_settings_set_updated_at
  ON public.team_periodization_settings;
CREATE TRIGGER team_periodization_settings_set_updated_at
  BEFORE UPDATE ON public.team_periodization_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_team_calendar_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_periodization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_periodization_settings_read   ON public.team_periodization_settings;
DROP POLICY IF EXISTS team_periodization_settings_insert ON public.team_periodization_settings;
DROP POLICY IF EXISTS team_periodization_settings_update ON public.team_periodization_settings;
DROP POLICY IF EXISTS team_periodization_settings_delete ON public.team_periodization_settings;

CREATE POLICY team_periodization_settings_read
  ON public.team_periodization_settings FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

CREATE POLICY team_periodization_settings_insert
  ON public.team_periodization_settings FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY team_periodization_settings_update
  ON public.team_periodization_settings FOR UPDATE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY team_periodization_settings_delete
  ON public.team_periodization_settings FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

GRANT ALL ON TABLE public.team_periodization_settings TO anon;
GRANT ALL ON TABLE public.team_periodization_settings TO authenticated;
GRANT ALL ON TABLE public.team_periodization_settings TO service_role;

COMMIT;
