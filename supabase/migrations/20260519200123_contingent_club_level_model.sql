-- Issue #35 — Migration modèle données contingent (EPIC #34 Gestion du contingent)
--
-- Objectif : faire remonter le joueur au niveau CLUB puis l'affecter à
-- une/plusieurs équipes par saison, et enrichir la fiche joueur
-- (préparation EPIC #53 TIPS ASF et EPIC #59 export BDNS).
--
-- 100 % ADDITIF : `players.team_id` / `players.trainer_id` sont conservés
-- (rendus nullable) pour que l'ancien et le nouveau code coexistent
-- pendant le déploiement. Les policies RLS club-scoped sur `players`
-- relèvent de la sous-issue #36.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. players : rattachement au club
-- ---------------------------------------------------------------------------
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS club_id uuid;

-- Backfill : chaque joueur existant hérite du club de son équipe.
UPDATE public.players p
   SET club_id = t.club_id
  FROM public.teams t
 WHERE t.id = p.team_id
   AND p.club_id IS NULL;

ALTER TABLE public.players
  ALTER COLUMN club_id SET NOT NULL;

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_club_id_fkey;
ALTER TABLE public.players
  ADD CONSTRAINT players_club_id_fkey
  FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS players_club_idx ON public.players USING btree (club_id);

-- ---------------------------------------------------------------------------
-- 2. players.team_id / trainer_id : dépréciés -> nullable
--    (un joueur du contingent peut désormais exister sans équipe)
-- ---------------------------------------------------------------------------
ALTER TABLE public.players ALTER COLUMN team_id    DROP NOT NULL;
ALTER TABLE public.players ALTER COLUMN trainer_id DROP NOT NULL;

COMMENT ON COLUMN public.players.team_id IS
  'DÉPRÉCIÉ (#35) : l''affectation aux équipes passe par player_team_assignments. Conservé pour rétro-compat.';
COMMENT ON COLUMN public.players.trainer_id IS
  'DÉPRÉCIÉ (#35) : le joueur est rattaché au club via club_id. Conservé pour rétro-compat.';

-- ---------------------------------------------------------------------------
-- 3. Fiche joueur enrichie (préparation TIPS ASF / export BDNS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS license_number    text,
  ADD COLUMN IF NOT EXISTS photo_url         text,
  ADD COLUMN IF NOT EXISTS email             text,
  ADD COLUMN IF NOT EXISTS phone             text,
  ADD COLUMN IF NOT EXISTS nationality       text,
  ADD COLUMN IF NOT EXISTS strong_foot       text,
  ADD COLUMN IF NOT EXISTS guardian_name     text,
  ADD COLUMN IF NOT EXISTS guardian_email    text,
  ADD COLUMN IF NOT EXISTS guardian_phone    text,
  ADD COLUMN IF NOT EXISTS guardian2_name    text,
  ADD COLUMN IF NOT EXISTS guardian2_email   text,
  ADD COLUMN IF NOT EXISTS guardian2_phone   text;

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_photo_url_length;
ALTER TABLE public.players
  ADD CONSTRAINT players_photo_url_length
  CHECK ((photo_url IS NULL) OR (length(photo_url) <= 500));

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_strong_foot_check;
ALTER TABLE public.players
  ADD CONSTRAINT players_strong_foot_check
  CHECK ((strong_foot IS NULL) OR (strong_foot IN ('left', 'right', 'both')));

-- ---------------------------------------------------------------------------
-- 3b. players.user_id : pont vers un compte (profil adaptable)
--     Permet qu'une même personne soit à la fois staff (club_memberships)
--     ET joueur (players.user_id = même compte) -> switch de vue. Voir #47.
--     Nullable : la majorité des fiches joueur n'ont pas de compte.
-- ---------------------------------------------------------------------------
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_user_id_fkey;
ALTER TABLE public.players
  ADD CONSTRAINT players_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Un compte ne peut pas être lié à 2 fiches joueur dans le même club.
CREATE UNIQUE INDEX IF NOT EXISTS players_club_user_unique_idx
  ON public.players USING btree (club_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS players_user_idx
  ON public.players USING btree (user_id);

COMMENT ON COLUMN public.players.user_id IS
  'Compte auth lié (#35/#47) : NULL si la fiche n''a pas de compte. Permet le profil adaptable joueur/entraîneur.';

-- ---------------------------------------------------------------------------
-- 4. player_team_assignments : affectation N–N joueur <-> équipe par saison
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_team_assignments (
    id         uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id  uuid NOT NULL,
    team_id    uuid NOT NULL,
    season     text,
    role       text DEFAULT 'player' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.player_team_assignments
  DROP CONSTRAINT IF EXISTS player_team_assignments_pkey;
ALTER TABLE ONLY public.player_team_assignments
  ADD CONSTRAINT player_team_assignments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.player_team_assignments
  DROP CONSTRAINT IF EXISTS player_team_assignments_player_id_fkey;
ALTER TABLE ONLY public.player_team_assignments
  ADD CONSTRAINT player_team_assignments_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.player_team_assignments
  DROP CONSTRAINT IF EXISTS player_team_assignments_team_id_fkey;
ALTER TABLE ONLY public.player_team_assignments
  ADD CONSTRAINT player_team_assignments_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- Un joueur n'est affecté qu'une fois à une équipe pour une saison donnée
-- (season NULL = legacy/affectation non datée).
CREATE UNIQUE INDEX IF NOT EXISTS player_team_assignments_unique_idx
  ON public.player_team_assignments
  USING btree (player_id, team_id, COALESCE(season, ''));

CREATE INDEX IF NOT EXISTS player_team_assignments_player_idx
  ON public.player_team_assignments USING btree (player_id);
CREATE INDEX IF NOT EXISTS player_team_assignments_team_idx
  ON public.player_team_assignments USING btree (team_id);

-- Backfill : reconstituer les affectations actuelles depuis players.team_id.
INSERT INTO public.player_team_assignments (player_id, team_id, season, role)
SELECT p.id, p.team_id, t.season, 'player'
  FROM public.players p
  JOIN public.teams t ON t.id = p.team_id
 WHERE p.team_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. RLS sur player_team_assignments
--    Calquée sur le modèle `players` actuel (accès par équipe + club actif).
--    L'évolution vers un modèle pleinement club-scoped relève de #36.
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_team_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_team_assignments_read   ON public.player_team_assignments;
DROP POLICY IF EXISTS player_team_assignments_insert ON public.player_team_assignments;
DROP POLICY IF EXISTS player_team_assignments_update ON public.player_team_assignments;
DROP POLICY IF EXISTS player_team_assignments_delete ON public.player_team_assignments;

CREATE POLICY player_team_assignments_read
  ON public.player_team_assignments FOR SELECT
  USING (private.user_team_access(team_id) IS NOT NULL);

CREATE POLICY player_team_assignments_insert
  ON public.player_team_assignments FOR INSERT
  WITH CHECK (
    (private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = player_team_assignments.team_id AND private.club_is_active(t.club_id))
  );

CREATE POLICY player_team_assignments_update
  ON public.player_team_assignments FOR UPDATE
  USING (
    (private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = player_team_assignments.team_id AND private.club_is_active(t.club_id))
  )
  WITH CHECK (
    (private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = player_team_assignments.team_id AND private.club_is_active(t.club_id))
  );

CREATE POLICY player_team_assignments_delete
  ON public.player_team_assignments FOR DELETE
  USING (
    (private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = player_team_assignments.team_id AND private.club_is_active(t.club_id))
  );

GRANT ALL ON TABLE public.player_team_assignments TO anon;
GRANT ALL ON TABLE public.player_team_assignments TO authenticated;
GRANT ALL ON TABLE public.player_team_assignments TO service_role;

COMMIT;
