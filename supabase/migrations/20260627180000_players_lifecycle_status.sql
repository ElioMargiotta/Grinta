-- Lot D — Cycle de vie de la fiche joueur (statut + dates) & déliage compte.
--
-- Une fiche joueur a désormais un STATUT de cycle de vie, distinct des
-- indisponibilités ponctuelles (player_unavailability, médical/discipline) :
--   active   → au contingent, visible partout (défaut).
--   inactive → temporairement hors effectif (prêt sortant, pause).
--   left     → a quitté le club (changement de club / transfert). Historique
--              conservé ; n'apparaît plus dans le roster actif.
--   archived → masqué (fin de parcours). Sort des listes par défaut.
--
-- Le changement de club = la fiche du club d'origine passe 'left' (on garde
-- l'historique), une NOUVELLE fiche est créée dans le club d'arrivée et
-- réclamée par le même compte (double passeport = même compte, 2 fiches
-- 'active' dans 2 clubs — déjà permis par l'unique (club_id, user_id)).
--
-- 100 % ADDITIF. Backfill : toutes les fiches existantes → 'active'.

BEGIN;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS status    text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'left', 'archived')),
  ADD COLUMN IF NOT EXISTS joined_at date,
  ADD COLUMN IF NOT EXISTS left_at   date;

CREATE INDEX IF NOT EXISTS players_club_status_idx
  ON public.players (club_id, status);

COMMENT ON COLUMN public.players.status IS
  'Cycle de vie de la fiche (Lot D) : active|inactive|left|archived. Distinct des indisponibilités ponctuelles.';
COMMENT ON COLUMN public.players.left_at IS
  'Date de départ du club (statut left/archived). Historique conservé.';

-- ---------------------------------------------------------------------------
-- RPC unlink_player_account : le staff (full/extended) délie le compte joueur
-- d'une fiche (mis-claim, transfert). Remet players.user_id à NULL ; les liens
-- tuteurs (player_guardians) restent gérés séparément. SECURITY DEFINER pour
-- une autorisation explicite et un message d'erreur propre.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlink_player_account(p_player_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT club_id INTO v_club_id FROM public.players WHERE id = p_player_id;
  IF v_club_id IS NULL THEN RAISE EXCEPTION 'player_not_found'; END IF;

  IF private.user_club_access(v_club_id)
       NOT IN ('full'::public.access_level, 'extended'::public.access_level) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.players SET user_id = NULL WHERE id = p_player_id;
END$$;

REVOKE ALL ON FUNCTION public.unlink_player_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlink_player_account(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
