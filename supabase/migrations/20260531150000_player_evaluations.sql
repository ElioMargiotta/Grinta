-- Issue #53 — EPIC Suivi du joueur (TIPS / ASF)
--
-- Table d'évaluation joueur, librement créée par le staff. Une fiche
-- joueur (`players`) peut avoir plusieurs évaluations dans le temps
-- (saison, date d'évaluation libre). Les données du formulaire (stats
-- Tour 1/2, tests ASF, scores TIPS, points forts / à améliorer,
-- appréciation, signatures) vivent en JSONB pour rester souples le
-- temps de stabiliser le schéma fonctionnel.
--
-- RLS : modèle club-scoped (cf. #36) calqué sur `players`.
--   lecture  = membre du club, ou le joueur lui-même (via players.user_id)
--   écriture = full / extended / team + club actif

BEGIN;

CREATE TABLE IF NOT EXISTS public.player_evaluations (
    id               uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id        uuid NOT NULL,
    club_id          uuid NOT NULL,
    created_by       uuid,
    season           text,
    evaluation_date  date,
    data             jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at       timestamp with time zone DEFAULT now() NOT NULL,
    updated_at       timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.player_evaluations
  DROP CONSTRAINT IF EXISTS player_evaluations_pkey;
ALTER TABLE ONLY public.player_evaluations
  ADD CONSTRAINT player_evaluations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.player_evaluations
  DROP CONSTRAINT IF EXISTS player_evaluations_player_id_fkey;
ALTER TABLE ONLY public.player_evaluations
  ADD CONSTRAINT player_evaluations_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.player_evaluations
  DROP CONSTRAINT IF EXISTS player_evaluations_club_id_fkey;
ALTER TABLE ONLY public.player_evaluations
  ADD CONSTRAINT player_evaluations_club_id_fkey
  FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.player_evaluations
  DROP CONSTRAINT IF EXISTS player_evaluations_created_by_fkey;
ALTER TABLE ONLY public.player_evaluations
  ADD CONSTRAINT player_evaluations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS player_evaluations_player_idx
  ON public.player_evaluations USING btree (player_id);
CREATE INDEX IF NOT EXISTS player_evaluations_club_idx
  ON public.player_evaluations USING btree (club_id);
CREATE INDEX IF NOT EXISTS player_evaluations_date_idx
  ON public.player_evaluations USING btree (evaluation_date DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_evaluations_read       ON public.player_evaluations;
DROP POLICY IF EXISTS player_evaluations_read_self  ON public.player_evaluations;
DROP POLICY IF EXISTS player_evaluations_insert     ON public.player_evaluations;
DROP POLICY IF EXISTS player_evaluations_update     ON public.player_evaluations;
DROP POLICY IF EXISTS player_evaluations_delete     ON public.player_evaluations;

CREATE POLICY player_evaluations_read
  ON public.player_evaluations FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

-- Le joueur lié peut lire ses propres évaluations (lecture seule).
CREATE POLICY player_evaluations_read_self
  ON public.player_evaluations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.players p
     WHERE p.id = player_evaluations.player_id
       AND p.user_id = (SELECT auth.uid())
  ));

CREATE POLICY player_evaluations_insert
  ON public.player_evaluations FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY player_evaluations_update
  ON public.player_evaluations FOR UPDATE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY player_evaluations_delete
  ON public.player_evaluations FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

GRANT ALL ON TABLE public.player_evaluations TO anon;
GRANT ALL ON TABLE public.player_evaluations TO authenticated;
GRANT ALL ON TABLE public.player_evaluations TO service_role;

COMMIT;
