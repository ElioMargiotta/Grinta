-- Suivi physique : passage au modèle « par date de test » + liaison planning
--
-- Fait évoluer le module physique (cf. 20260618130000) :
--   * physical_metrics       : + description, + protocol (fiche-protocole du test)
--   * physical_measurements  : week_start → measured_on + session_id
--                              (cadence libre : 1×/sem, 2×/sem, mensuel, ponctuel)
--   * session_physical_tests : tests rattachés à une séance du planner
--
-- Forward-only et idempotent : peut s'appliquer sur une base ayant déjà l'ancien
-- schéma (semaine) sans casser les données existantes.

BEGIN;

-- ---------------------------------------------------------------------------
-- physical_metrics : description + protocole
-- ---------------------------------------------------------------------------
ALTER TABLE public.physical_metrics ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.physical_metrics ADD COLUMN IF NOT EXISTS protocol    text;

-- ---------------------------------------------------------------------------
-- physical_measurements : week_start → measured_on (+ session_id)
-- ---------------------------------------------------------------------------
ALTER TABLE public.physical_measurements ADD COLUMN IF NOT EXISTS session_id uuid;

-- Renommage week_start → measured_on (uniquement si pas déjà fait).
DO $$
BEGIN
  IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'physical_measurements'
           AND column_name = 'week_start'
     ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'physical_measurements'
           AND column_name = 'measured_on'
     )
  THEN
    ALTER TABLE public.physical_measurements RENAME COLUMN week_start TO measured_on;
  END IF;
END $$;

-- Mesure rattachée à une séance : si la séance disparaît, on garde la mesure.
ALTER TABLE public.physical_measurements
  DROP CONSTRAINT IF EXISTS physical_measurements_session_id_fkey;
ALTER TABLE public.physical_measurements
  ADD CONSTRAINT physical_measurements_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;

-- Unicité par joueur / test / date (remplace l'unicité hebdo).
ALTER TABLE public.physical_measurements
  DROP CONSTRAINT IF EXISTS physical_measurements_unique_week;
ALTER TABLE public.physical_measurements
  DROP CONSTRAINT IF EXISTS physical_measurements_unique_day;
ALTER TABLE public.physical_measurements
  ADD CONSTRAINT physical_measurements_unique_day
  UNIQUE (player_id, metric_id, measured_on);

DROP INDEX IF EXISTS public.physical_measurements_player_week_idx;
CREATE INDEX IF NOT EXISTS physical_measurements_player_date_idx
  ON public.physical_measurements USING btree (player_id, measured_on);
CREATE INDEX IF NOT EXISTS physical_measurements_session_idx
  ON public.physical_measurements USING btree (session_id);

-- ---------------------------------------------------------------------------
-- session_physical_tests — tests rattachés à une séance du planner
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_physical_tests (
    id          uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id     uuid NOT NULL,
    session_id  uuid NOT NULL,
    metric_id   uuid NOT NULL,
    created_by  uuid,
    created_at  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.session_physical_tests
  DROP CONSTRAINT IF EXISTS session_physical_tests_pkey;
ALTER TABLE ONLY public.session_physical_tests
  ADD CONSTRAINT session_physical_tests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_physical_tests
  DROP CONSTRAINT IF EXISTS session_physical_tests_club_id_fkey;
ALTER TABLE ONLY public.session_physical_tests
  ADD CONSTRAINT session_physical_tests_club_id_fkey
  FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.session_physical_tests
  DROP CONSTRAINT IF EXISTS session_physical_tests_session_id_fkey;
ALTER TABLE ONLY public.session_physical_tests
  ADD CONSTRAINT session_physical_tests_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.session_physical_tests
  DROP CONSTRAINT IF EXISTS session_physical_tests_metric_id_fkey;
ALTER TABLE ONLY public.session_physical_tests
  ADD CONSTRAINT session_physical_tests_metric_id_fkey
  FOREIGN KEY (metric_id) REFERENCES public.physical_metrics(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.session_physical_tests
  DROP CONSTRAINT IF EXISTS session_physical_tests_created_by_fkey;
ALTER TABLE ONLY public.session_physical_tests
  ADD CONSTRAINT session_physical_tests_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_physical_tests
  DROP CONSTRAINT IF EXISTS session_physical_tests_unique;
ALTER TABLE ONLY public.session_physical_tests
  ADD CONSTRAINT session_physical_tests_unique
  UNIQUE (session_id, metric_id);

CREATE INDEX IF NOT EXISTS session_physical_tests_session_idx
  ON public.session_physical_tests USING btree (session_id);

ALTER TABLE public.session_physical_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_physical_tests_read   ON public.session_physical_tests;
DROP POLICY IF EXISTS session_physical_tests_insert ON public.session_physical_tests;
DROP POLICY IF EXISTS session_physical_tests_delete ON public.session_physical_tests;

CREATE POLICY session_physical_tests_read
  ON public.session_physical_tests FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

CREATE POLICY session_physical_tests_insert
  ON public.session_physical_tests FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY session_physical_tests_delete
  ON public.session_physical_tests FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

GRANT ALL ON TABLE public.session_physical_tests TO anon;
GRANT ALL ON TABLE public.session_physical_tests TO authenticated;
GRANT ALL ON TABLE public.session_physical_tests TO service_role;

COMMIT;
