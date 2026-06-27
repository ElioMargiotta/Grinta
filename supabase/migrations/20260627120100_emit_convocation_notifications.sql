-- Lot 1 — Branchement du Notification Hub sur l'envoi de convocation.
--
-- Quand le staff envoie la convocation d'un match (team_matches.convocation_sent_at
-- passe à NOT NULL), chaque joueur convoqué ET disposant d'un compte lié reçoit
-- une notification 'match_convocation' actionnable côté joueur (Confirmer /
-- Décliner via respond_to_match). Côté staff, le suivi des réponses reste sur la
-- fiche match — pas de notif émise au coach ici.
--
-- L'émission est idempotente par (match, destinataire) : ré-enregistrer / ré-
-- envoyer ne crée pas de doublon.

BEGIN;

CREATE OR REPLACE FUNCTION public.emit_match_convocation_notifications(p_match_id uuid)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_team_id  uuid;
  v_club_id  uuid;
  v_sent_at  timestamptz;
  v_count    integer := 0;
  v_payload  jsonb;
  r          record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT m.team_id, m.club_id, m.convocation_sent_at
    INTO v_team_id, v_club_id, v_sent_at
    FROM public.team_matches m
   WHERE m.id = p_match_id;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'match_not_found';
  END IF;

  -- Garde-fou : seul le staff du club (accès à l'équipe) peut déclencher l'envoi.
  IF private.user_team_access(v_team_id) IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- On n'émet que pour une convocation réellement envoyée.
  IF v_sent_at IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT p.user_id,
           m.id          AS match_id,
           m.team_id,
           t.name        AS team_name,
           m.starts_at,
           m.opponent,
           m.location,
           m.kind,
           m.home_away
      FROM public.match_participations mp
      JOIN public.players p      ON p.id = mp.player_id
      JOIN public.team_matches m ON m.id = mp.match_id
      JOIN public.teams t        ON t.id = m.team_id
     WHERE mp.match_id = p_match_id
       AND mp.called_up = true
       AND p.user_id IS NOT NULL
  LOOP
    -- Idempotence : pas de seconde notif de convocation pour ce match/joueur.
    IF EXISTS (
      SELECT 1 FROM public.notifications n
       WHERE n.user_id = r.user_id
         AND n.type = 'match_convocation'
         AND n.payload->>'match_id' = p_match_id::text
    ) THEN
      CONTINUE;
    END IF;

    v_payload := jsonb_build_object(
      'match_id',  r.match_id,
      'team_id',   r.team_id,
      'team_name', r.team_name,
      'starts_at', r.starts_at,
      'opponent',  r.opponent,
      'location',  r.location,
      'kind',      r.kind,
      'home_away', r.home_away
    );

    PERFORM private.emit_notification(
      r.user_id, 'match_convocation', v_payload, v_club_id, v_user_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END$$;

REVOKE ALL ON FUNCTION public.emit_match_convocation_notifications(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emit_match_convocation_notifications(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
