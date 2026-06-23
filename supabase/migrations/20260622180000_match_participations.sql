-- Lot 2 (kit de match) — feuille de match : participations des joueurs.
--
-- Une row par (match, joueur) du contingent. Statut = rôle tenu sur ce match
-- (titulaire / remplaçant entré / sur le banc non utilisé / indisponible) +
-- stats individuelles (minutes, buts, passes, cartons). Sert de fondation au
-- reste du kit (compo tactique, feuille imprimable).
--
-- `club_id` est dénormalisé (comme `team_matches`) pour une RLS simple via
-- `private.user_club_access(club_id)`, sans jointure.
--
-- Additif, schéma public uniquement.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. enum statut de participation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_participation_status') THEN
    CREATE TYPE public.match_participation_status AS ENUM (
      'starter',      -- titulaire
      'substitute',   -- remplaçant entré en jeu
      'unused',       -- sur le banc, non utilisé
      'unavailable'   -- indisponible (blessé / suspendu / absent)
    );
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 2. match_participations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_participations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     uuid NOT NULL REFERENCES public.team_matches(id) ON DELETE CASCADE,
  player_id    uuid NOT NULL REFERENCES public.players(id)      ON DELETE CASCADE,
  club_id      uuid NOT NULL REFERENCES public.clubs(id)        ON DELETE CASCADE,

  status       public.match_participation_status NOT NULL DEFAULT 'starter',
  minutes      integer,
  goals        integer  NOT NULL DEFAULT 0,
  assists      integer  NOT NULL DEFAULT 0,
  yellow_cards smallint NOT NULL DEFAULT 0,
  red_card     boolean  NOT NULL DEFAULT false,
  -- Emplacement tactique (libre pour l'instant ; pilotera la compo drag-drop).
  position     text,
  note         text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT match_participations_unique UNIQUE (match_id, player_id),
  CONSTRAINT match_participations_minutes_range CHECK (
    minutes IS NULL OR (minutes >= 0 AND minutes <= 200)
  ),
  CONSTRAINT match_participations_goals_range   CHECK (goals   >= 0 AND goals   <= 50),
  CONSTRAINT match_participations_assists_range CHECK (assists >= 0 AND assists <= 50),
  CONSTRAINT match_participations_yellow_range  CHECK (yellow_cards >= 0 AND yellow_cards <= 2),
  CONSTRAINT match_participations_position_length CHECK (
    position IS NULL OR length(position) <= 40
  ),
  CONSTRAINT match_participations_note_length CHECK (
    note IS NULL OR length(note) <= 500
  )
);

CREATE INDEX IF NOT EXISTS match_participations_match_idx
  ON public.match_participations (match_id);
CREATE INDEX IF NOT EXISTS match_participations_player_idx
  ON public.match_participations (player_id);
CREATE INDEX IF NOT EXISTS match_participations_club_idx
  ON public.match_participations (club_id);

-- trigger updated_at
CREATE OR REPLACE FUNCTION public.set_match_participations_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS match_participations_set_updated_at ON public.match_participations;
CREATE TRIGGER match_participations_set_updated_at
  BEFORE UPDATE ON public.match_participations
  FOR EACH ROW EXECUTE FUNCTION public.set_match_participations_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS — calquée sur team_matches (accès par club, écriture staff club actif)
-- ---------------------------------------------------------------------------
ALTER TABLE public.match_participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS match_participations_read   ON public.match_participations;
DROP POLICY IF EXISTS match_participations_insert ON public.match_participations;
DROP POLICY IF EXISTS match_participations_update ON public.match_participations;
DROP POLICY IF EXISTS match_participations_delete ON public.match_participations;

CREATE POLICY match_participations_read
  ON public.match_participations FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

CREATE POLICY match_participations_insert
  ON public.match_participations FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY match_participations_update
  ON public.match_participations FOR UPDATE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY match_participations_delete
  ON public.match_participations FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

GRANT ALL ON TABLE public.match_participations TO anon;
GRANT ALL ON TABLE public.match_participations TO authenticated;
GRANT ALL ON TABLE public.match_participations TO service_role;

COMMIT;
