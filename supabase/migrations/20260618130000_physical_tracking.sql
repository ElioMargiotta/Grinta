-- Suivi physique personnalisé hebdomadaire
--
-- Module dédié (distinct de `player_evaluations` / fiche TIPS-ASF) : le staff
-- définit ses propres indicateurs physiques (VMA, sprint 10 m, Yo-Yo, tests
-- spécifiques…) au niveau du club, puis saisit les résultats par joueur et
-- **par semaine** (clé `week_start` = lundi ISO de la semaine).
--
--   * physical_metrics      : définitions d'indicateurs, mutualisées au club
--   * physical_measurements : valeurs par joueur / indicateur / semaine
--
-- RLS : modèle club-scoped calqué sur `players` / `player_evaluations` (#36, #53).
--   metrics      read = membre du club, write = full/extended + club actif
--   measurements read = membre du club OU le joueur lié (lecture seule),
--                write = full/extended/team + club actif

BEGIN;

-- ---------------------------------------------------------------------------
-- physical_metrics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.physical_metrics (
    id                uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id           uuid NOT NULL,
    created_by        uuid,
    name              text NOT NULL,
    unit              text,
    category          text,
    higher_is_better  boolean NOT NULL DEFAULT true,
    sort_order        integer NOT NULL DEFAULT 0,
    archived          boolean NOT NULL DEFAULT false,
    created_at        timestamp with time zone DEFAULT now() NOT NULL,
    updated_at        timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.physical_metrics
  DROP CONSTRAINT IF EXISTS physical_metrics_pkey;
ALTER TABLE ONLY public.physical_metrics
  ADD CONSTRAINT physical_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.physical_metrics
  DROP CONSTRAINT IF EXISTS physical_metrics_club_id_fkey;
ALTER TABLE ONLY public.physical_metrics
  ADD CONSTRAINT physical_metrics_club_id_fkey
  FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.physical_metrics
  DROP CONSTRAINT IF EXISTS physical_metrics_created_by_fkey;
ALTER TABLE ONLY public.physical_metrics
  ADD CONSTRAINT physical_metrics_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.physical_metrics
  DROP CONSTRAINT IF EXISTS physical_metrics_name_length;
ALTER TABLE ONLY public.physical_metrics
  ADD CONSTRAINT physical_metrics_name_length CHECK (
    length(name) BETWEEN 1 AND 120
  );

CREATE INDEX IF NOT EXISTS physical_metrics_club_idx
  ON public.physical_metrics USING btree (club_id, archived, sort_order);

-- ---------------------------------------------------------------------------
-- physical_measurements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.physical_measurements (
    id            uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id       uuid NOT NULL,
    player_id     uuid NOT NULL,
    metric_id     uuid NOT NULL,
    week_start    date NOT NULL,
    value         numeric,
    note          text,
    recorded_by   uuid,
    created_at    timestamp with time zone DEFAULT now() NOT NULL,
    updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.physical_measurements
  DROP CONSTRAINT IF EXISTS physical_measurements_pkey;
ALTER TABLE ONLY public.physical_measurements
  ADD CONSTRAINT physical_measurements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.physical_measurements
  DROP CONSTRAINT IF EXISTS physical_measurements_club_id_fkey;
ALTER TABLE ONLY public.physical_measurements
  ADD CONSTRAINT physical_measurements_club_id_fkey
  FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.physical_measurements
  DROP CONSTRAINT IF EXISTS physical_measurements_player_id_fkey;
ALTER TABLE ONLY public.physical_measurements
  ADD CONSTRAINT physical_measurements_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.physical_measurements
  DROP CONSTRAINT IF EXISTS physical_measurements_metric_id_fkey;
ALTER TABLE ONLY public.physical_measurements
  ADD CONSTRAINT physical_measurements_metric_id_fkey
  FOREIGN KEY (metric_id) REFERENCES public.physical_metrics(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.physical_measurements
  DROP CONSTRAINT IF EXISTS physical_measurements_recorded_by_fkey;
ALTER TABLE ONLY public.physical_measurements
  ADD CONSTRAINT physical_measurements_recorded_by_fkey
  FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Un seul enregistrement par joueur / indicateur / semaine (cible de l'upsert).
ALTER TABLE ONLY public.physical_measurements
  DROP CONSTRAINT IF EXISTS physical_measurements_unique_week;
ALTER TABLE ONLY public.physical_measurements
  ADD CONSTRAINT physical_measurements_unique_week
  UNIQUE (player_id, metric_id, week_start);

CREATE INDEX IF NOT EXISTS physical_measurements_player_week_idx
  ON public.physical_measurements USING btree (player_id, week_start);
CREATE INDEX IF NOT EXISTS physical_measurements_metric_idx
  ON public.physical_measurements USING btree (metric_id);

-- ---------------------------------------------------------------------------
-- RLS — physical_metrics
-- ---------------------------------------------------------------------------
ALTER TABLE public.physical_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS physical_metrics_read   ON public.physical_metrics;
DROP POLICY IF EXISTS physical_metrics_insert ON public.physical_metrics;
DROP POLICY IF EXISTS physical_metrics_update ON public.physical_metrics;
DROP POLICY IF EXISTS physical_metrics_delete ON public.physical_metrics;

CREATE POLICY physical_metrics_read
  ON public.physical_metrics FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

CREATE POLICY physical_metrics_insert
  ON public.physical_metrics FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY physical_metrics_update
  ON public.physical_metrics FOR UPDATE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY physical_metrics_delete
  ON public.physical_metrics FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level]))
    AND private.club_is_active(club_id)
  );

-- ---------------------------------------------------------------------------
-- RLS — physical_measurements
-- ---------------------------------------------------------------------------
ALTER TABLE public.physical_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS physical_measurements_read      ON public.physical_measurements;
DROP POLICY IF EXISTS physical_measurements_read_self ON public.physical_measurements;
DROP POLICY IF EXISTS physical_measurements_insert    ON public.physical_measurements;
DROP POLICY IF EXISTS physical_measurements_update    ON public.physical_measurements;
DROP POLICY IF EXISTS physical_measurements_delete    ON public.physical_measurements;

CREATE POLICY physical_measurements_read
  ON public.physical_measurements FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

-- Le joueur lié peut lire ses propres mesures (lecture seule).
CREATE POLICY physical_measurements_read_self
  ON public.physical_measurements FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.players p
     WHERE p.id = physical_measurements.player_id
       AND p.user_id = (SELECT auth.uid())
  ));

CREATE POLICY physical_measurements_insert
  ON public.physical_measurements FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY physical_measurements_update
  ON public.physical_measurements FOR UPDATE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY physical_measurements_delete
  ON public.physical_measurements FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

GRANT ALL ON TABLE public.physical_metrics TO anon;
GRANT ALL ON TABLE public.physical_metrics TO authenticated;
GRANT ALL ON TABLE public.physical_metrics TO service_role;

GRANT ALL ON TABLE public.physical_measurements TO anon;
GRANT ALL ON TABLE public.physical_measurements TO authenticated;
GRANT ALL ON TABLE public.physical_measurements TO service_role;

COMMIT;
