-- Kit de match — envoi explicite de la convocation.
--
-- Jusqu'ici, enregistrer la compo (called_up = true) rendait immédiatement le
-- match visible au joueur dans son agenda : la convocation était « envoyée »
-- automatiquement. On découple désormais « construire la compo » de « envoyer la
-- convocation » via team_matches.convocation_sent_at : tant que ce timestamp est
-- NULL, le joueur ne voit pas le match (et ne peut pas répondre). Le coach
-- déclenche l'envoi explicitement.

BEGIN;

ALTER TABLE public.team_matches
  ADD COLUMN IF NOT EXISTS convocation_sent_at timestamptz;

-- ---------------------------------------------------------------------------
-- Lecture côté joueur : ses convocations à venir, désormais filtrées sur les
-- convocations RÉELLEMENT envoyées (convocation_sent_at IS NOT NULL).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.player_match_callups()
  RETURNS TABLE (
    match_id            uuid,
    starts_at           timestamptz,
    team_name           text,
    summary             text,
    opponent            text,
    location            text,
    kind                text,
    home_away           text,
    availability        text,
    availability_reason text
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT m.id, m.starts_at, t.name, m.summary, m.opponent, m.location,
         m.kind, m.home_away, mp.availability, mp.availability_reason
    FROM public.match_participations mp
    JOIN public.team_matches m ON m.id = mp.match_id
    JOIN public.teams t        ON t.id = m.team_id
    JOIN public.players p      ON p.id = mp.player_id
   WHERE p.user_id = auth.uid()
     AND mp.called_up = true
     AND m.convocation_sent_at IS NOT NULL
     AND m.starts_at >= now()
   ORDER BY m.starts_at ASC;
$$;

REVOKE ALL ON FUNCTION public.player_match_callups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.player_match_callups() TO authenticated;

-- ---------------------------------------------------------------------------
-- Réponse du joueur : exige en plus que la convocation ait été envoyée. Un
-- joueur ne peut répondre qu'à une convocation visible (garde-fou : il ne la
-- voit pas tant que convocation_sent_at est NULL).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_to_match(
  p_match_id uuid,
  p_status   text,
  p_reason   text DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_player_id  uuid;
  v_team_id    uuid;
  v_club_id    uuid;
  v_starts_at  timestamptz;
  v_sent_at    timestamptz;
  v_id         uuid;
  v_reason     text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_status NOT IN ('available', 'unavailable') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  IF p_status = 'unavailable' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'reason_required_when_unavailable';
  END IF;

  SELECT m.team_id, m.club_id, m.starts_at, m.convocation_sent_at
    INTO v_team_id, v_club_id, v_starts_at, v_sent_at
    FROM public.team_matches m
   WHERE m.id = p_match_id;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  IF NOT private.club_is_active(v_club_id) THEN
    RAISE EXCEPTION 'club_inactive';
  END IF;

  IF v_starts_at <= now() THEN
    RAISE EXCEPTION 'match_finished';
  END IF;

  -- La convocation doit avoir été envoyée par le staff.
  IF v_sent_at IS NULL THEN
    RAISE EXCEPTION 'not_called_up';
  END IF;

  -- Le joueur doit avoir une fiche dans ce club ET être affecté à l'équipe.
  SELECT p.id
    INTO v_player_id
    FROM public.players p
    JOIN public.player_team_assignments pta ON pta.player_id = p.id
   WHERE p.user_id = v_user_id
     AND p.club_id = v_club_id
     AND pta.team_id = v_team_id
   LIMIT 1;

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'not_assigned_to_team';
  END IF;

  -- Il doit être CONVOQUÉ : la row participation existe et called_up = true.
  UPDATE public.match_participations
     SET availability        = p_status,
         availability_reason = v_reason,
         availability_at     = now()
   WHERE match_id = p_match_id
     AND player_id = v_player_id
     AND called_up = true
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'not_called_up';
  END IF;

  RETURN v_id;
END$$;

REVOKE ALL ON FUNCTION public.respond_to_match(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_match(uuid, text, text) TO authenticated;

COMMIT;
