-- Indisponibilités joueur (médical / discipline / autre)
--
-- Source de vérité unique de la disponibilité d'un joueur sur une PÉRIODE.
-- Une indisponibilité couvre automatiquement toutes les séances/évals de
-- l'intervalle [start_date, end_date] (end_date NULL = encore en cours) :
--   * la grille éval affiche « Blessé / Absent » au lieu d'une saisie ;
--   * le roster de présence affiche le badge sans ressaisie.
--
--   kind : injury (blessure) | illness (maladie) | suspension | other
--
-- Accès :
--   - Staff (full/extended/team) : lecture/écriture sur les joueurs du club.
--   - Joueur lié : lecture de ses propres indisponibilités.
-- Forward-only et idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.player_unavailability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL,
  player_id   uuid NOT NULL,
  kind        text NOT NULL DEFAULT 'injury',
  reason      text,
  start_date  date NOT NULL,
  end_date    date,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.player_unavailability
  DROP CONSTRAINT IF EXISTS player_unavailability_kind_check;
ALTER TABLE public.player_unavailability
  ADD CONSTRAINT player_unavailability_kind_check
  CHECK (kind IN ('injury', 'illness', 'suspension', 'other'));

ALTER TABLE public.player_unavailability
  DROP CONSTRAINT IF EXISTS player_unavailability_dates_check;
ALTER TABLE public.player_unavailability
  ADD CONSTRAINT player_unavailability_dates_check
  CHECK (end_date IS NULL OR end_date >= start_date);

ALTER TABLE public.player_unavailability
  DROP CONSTRAINT IF EXISTS player_unavailability_reason_length;
ALTER TABLE public.player_unavailability
  ADD CONSTRAINT player_unavailability_reason_length
  CHECK (reason IS NULL OR length(reason) <= 500);

ALTER TABLE public.player_unavailability
  DROP CONSTRAINT IF EXISTS player_unavailability_club_id_fkey;
ALTER TABLE public.player_unavailability
  ADD CONSTRAINT player_unavailability_club_id_fkey
  FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE public.player_unavailability
  DROP CONSTRAINT IF EXISTS player_unavailability_player_id_fkey;
ALTER TABLE public.player_unavailability
  ADD CONSTRAINT player_unavailability_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.player_unavailability
  DROP CONSTRAINT IF EXISTS player_unavailability_created_by_fkey;
ALTER TABLE public.player_unavailability
  ADD CONSTRAINT player_unavailability_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS player_unavailability_player_idx
  ON public.player_unavailability USING btree (player_id, start_date);
CREATE INDEX IF NOT EXISTS player_unavailability_club_idx
  ON public.player_unavailability USING btree (club_id);

-- trigger updated_at (réutilise le helper générique s'il existe, sinon inline)
CREATE OR REPLACE FUNCTION public.set_player_unavailability_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS player_unavailability_set_updated_at ON public.player_unavailability;
CREATE TRIGGER player_unavailability_set_updated_at
  BEFORE UPDATE ON public.player_unavailability
  FOR EACH ROW EXECUTE FUNCTION public.set_player_unavailability_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_unavailability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_unavailability_read      ON public.player_unavailability;
DROP POLICY IF EXISTS player_unavailability_read_self ON public.player_unavailability;
DROP POLICY IF EXISTS player_unavailability_write     ON public.player_unavailability;

CREATE POLICY player_unavailability_read
  ON public.player_unavailability FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

-- Le joueur lié peut lire ses propres indisponibilités (lecture seule).
CREATE POLICY player_unavailability_read_self
  ON public.player_unavailability FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.players p
     WHERE p.id = player_unavailability.player_id
       AND p.user_id = (SELECT auth.uid())
  ));

CREATE POLICY player_unavailability_write
  ON public.player_unavailability FOR ALL
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

GRANT ALL ON TABLE public.player_unavailability TO anon;
GRANT ALL ON TABLE public.player_unavailability TO authenticated;
GRANT ALL ON TABLE public.player_unavailability TO service_role;

COMMIT;
