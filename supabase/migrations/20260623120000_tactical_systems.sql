-- Module « Systèmes de jeu » — bibliothèque de systèmes tactiques réutilisables
-- par équipe + phases arrêtées visuelles, et sélection de phases par match.
--
-- 3 volets, additifs sur le schéma public :
--   1. team_tactical_systems : un système = formation + compo (joueurs) + tactique.
--   2. team_tactical_phases  : phases arrêtées (corner, coup franc, mise en place…)
--      rattachées à un système ; board = jetons + flèches sur le terrain.
--   3. team_matches.selected_phase_ids : phases retenues pour un match donné.
--
-- RLS calquée sur match_kit / team_seasons : lecture par accès club, écriture staff
-- d'un club actif via private.user_club_access(club_id). club_id dénormalisé.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. team_tactical_systems
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_tactical_systems (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  name       text NOT NULL,
  formation  text,
  lineup     jsonb NOT NULL DEFAULT '{}'::jsonb,
  tactics    jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT team_tactical_systems_name_length CHECK (
    length(name) BETWEEN 1 AND 120
  ),
  CONSTRAINT team_tactical_systems_formation_length CHECK (
    formation IS NULL OR length(formation) <= 40
  )
);

CREATE INDEX IF NOT EXISTS team_tactical_systems_team_idx
  ON public.team_tactical_systems (team_id);
CREATE INDEX IF NOT EXISTS team_tactical_systems_club_idx
  ON public.team_tactical_systems (club_id);

ALTER TABLE public.team_tactical_systems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_tactical_systems_read   ON public.team_tactical_systems;
DROP POLICY IF EXISTS team_tactical_systems_insert ON public.team_tactical_systems;
DROP POLICY IF EXISTS team_tactical_systems_update ON public.team_tactical_systems;
DROP POLICY IF EXISTS team_tactical_systems_delete ON public.team_tactical_systems;

CREATE POLICY team_tactical_systems_read
  ON public.team_tactical_systems FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

CREATE POLICY team_tactical_systems_insert
  ON public.team_tactical_systems FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY team_tactical_systems_update
  ON public.team_tactical_systems FOR UPDATE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY team_tactical_systems_delete
  ON public.team_tactical_systems FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

GRANT ALL ON TABLE public.team_tactical_systems TO anon;
GRANT ALL ON TABLE public.team_tactical_systems TO authenticated;
GRANT ALL ON TABLE public.team_tactical_systems TO service_role;

-- ---------------------------------------------------------------------------
-- 2. team_tactical_phases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_tactical_phases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id  uuid NOT NULL REFERENCES public.team_tactical_systems(id) ON DELETE CASCADE,
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

  kind       text NOT NULL,
  name       text,
  board      jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT team_tactical_phases_kind_length CHECK (length(kind) <= 40),
  CONSTRAINT team_tactical_phases_name_length CHECK (
    name IS NULL OR length(name) <= 120
  )
);

CREATE INDEX IF NOT EXISTS team_tactical_phases_system_idx
  ON public.team_tactical_phases (system_id);
CREATE INDEX IF NOT EXISTS team_tactical_phases_club_idx
  ON public.team_tactical_phases (club_id);

ALTER TABLE public.team_tactical_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_tactical_phases_read   ON public.team_tactical_phases;
DROP POLICY IF EXISTS team_tactical_phases_insert ON public.team_tactical_phases;
DROP POLICY IF EXISTS team_tactical_phases_update ON public.team_tactical_phases;
DROP POLICY IF EXISTS team_tactical_phases_delete ON public.team_tactical_phases;

CREATE POLICY team_tactical_phases_read
  ON public.team_tactical_phases FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

CREATE POLICY team_tactical_phases_insert
  ON public.team_tactical_phases FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY team_tactical_phases_update
  ON public.team_tactical_phases FOR UPDATE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY team_tactical_phases_delete
  ON public.team_tactical_phases FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

GRANT ALL ON TABLE public.team_tactical_phases TO anon;
GRANT ALL ON TABLE public.team_tactical_phases TO authenticated;
GRANT ALL ON TABLE public.team_tactical_phases TO service_role;

-- ---------------------------------------------------------------------------
-- 3. team_matches : phases retenues pour le match
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_matches
  ADD COLUMN IF NOT EXISTS selected_phase_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
