-- Lot 2 (kit de match « FIFA ») — compo visuelle, tactique, convocation & événements.
--
-- 3 volets, tous additifs sur le schéma public :
--   1. team_matches : formation jouée + consignes tactiques.
--   2. match_participations : axe convocation (called_up + réponse joueur) et
--      position du jeton sur le terrain (compo visuelle). Les colonnes de stats
--      goals/assists/yellow_cards/red_card (créées au volet feuille de match)
--      deviennent un CACHE recalculé depuis match_events.
--   3. match_events : la timeline « faits de match » (buts, cartons, changements,
--      notes) d'où se dérivent buteurs / passeurs / changements.
--
-- RLS partout calquée sur team_matches : lecture par accès club, écriture staff
-- d'un club actif via private.user_club_access(club_id). club_id dénormalisé.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. team_matches : formation + tactique
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_matches
  ADD COLUMN IF NOT EXISTS formation text,
  ADD COLUMN IF NOT EXISTS tactics   jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.team_matches
  DROP CONSTRAINT IF EXISTS team_matches_formation_length;
ALTER TABLE public.team_matches
  ADD CONSTRAINT team_matches_formation_length CHECK (
    formation IS NULL OR length(formation) <= 20
  );

-- ---------------------------------------------------------------------------
-- 2. match_participations : convocation + position terrain
-- ---------------------------------------------------------------------------
-- Un joueur convoqué mais non encore placé = banc (et non titulaire par défaut).
ALTER TABLE public.match_participations
  ALTER COLUMN status SET DEFAULT 'unused';

ALTER TABLE public.match_participations
  ADD COLUMN IF NOT EXISTS called_up          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS availability        text,
  ADD COLUMN IF NOT EXISTS availability_reason text,
  ADD COLUMN IF NOT EXISTS availability_at     timestamptz,
  ADD COLUMN IF NOT EXISTS pitch_x             numeric,
  ADD COLUMN IF NOT EXISTS pitch_y             numeric,
  ADD COLUMN IF NOT EXISTS slot_role           text;

ALTER TABLE public.match_participations
  DROP CONSTRAINT IF EXISTS match_participations_availability_check;
ALTER TABLE public.match_participations
  ADD CONSTRAINT match_participations_availability_check CHECK (
    availability IS NULL OR availability IN ('available', 'unavailable')
  );

ALTER TABLE public.match_participations
  DROP CONSTRAINT IF EXISTS match_participations_availability_reason_length;
ALTER TABLE public.match_participations
  ADD CONSTRAINT match_participations_availability_reason_length CHECK (
    availability_reason IS NULL OR length(availability_reason) <= 500
  );

ALTER TABLE public.match_participations
  DROP CONSTRAINT IF EXISTS match_participations_pitch_range;
ALTER TABLE public.match_participations
  ADD CONSTRAINT match_participations_pitch_range CHECK (
    (pitch_x IS NULL OR (pitch_x >= 0 AND pitch_x <= 100))
    AND (pitch_y IS NULL OR (pitch_y >= 0 AND pitch_y <= 100))
  );

ALTER TABLE public.match_participations
  DROP CONSTRAINT IF EXISTS match_participations_slot_role_length;
ALTER TABLE public.match_participations
  ADD CONSTRAINT match_participations_slot_role_length CHECK (
    slot_role IS NULL OR length(slot_role) <= 20
  );

-- ---------------------------------------------------------------------------
-- 3. match_events : timeline des faits de match
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_event_type') THEN
    CREATE TYPE public.match_event_type AS ENUM (
      'goal',          -- but de notre équipe (player_id = buteur, related = passeur)
      'own_goal',      -- csc d'un de nos joueurs (player_id = joueur concerné)
      'yellow',        -- carton jaune
      'red',           -- carton rouge
      'substitution',  -- changement (player_id = entrant, related = sortant)
      'note'           -- fait de match libre
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.match_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id           uuid NOT NULL REFERENCES public.team_matches(id) ON DELETE CASCADE,
  club_id            uuid NOT NULL REFERENCES public.clubs(id)        ON DELETE CASCADE,

  type               public.match_event_type NOT NULL,
  minute             smallint,
  player_id          uuid REFERENCES public.players(id) ON DELETE SET NULL,
  related_player_id  uuid REFERENCES public.players(id) ON DELETE SET NULL,
  is_penalty         boolean NOT NULL DEFAULT false,
  note               text,
  sort_order         integer NOT NULL DEFAULT 0,

  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT match_events_minute_range CHECK (
    minute IS NULL OR (minute >= 0 AND minute <= 130)
  ),
  CONSTRAINT match_events_note_length CHECK (
    note IS NULL OR length(note) <= 500
  )
);

CREATE INDEX IF NOT EXISTS match_events_match_idx ON public.match_events (match_id);
CREATE INDEX IF NOT EXISTS match_events_club_idx  ON public.match_events (club_id);

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS match_events_read   ON public.match_events;
DROP POLICY IF EXISTS match_events_insert ON public.match_events;
DROP POLICY IF EXISTS match_events_update ON public.match_events;
DROP POLICY IF EXISTS match_events_delete ON public.match_events;

CREATE POLICY match_events_read
  ON public.match_events FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

CREATE POLICY match_events_insert
  ON public.match_events FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY match_events_update
  ON public.match_events FOR UPDATE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY match_events_delete
  ON public.match_events FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

GRANT ALL ON TABLE public.match_events TO anon;
GRANT ALL ON TABLE public.match_events TO authenticated;
GRANT ALL ON TABLE public.match_events TO service_role;

COMMIT;
