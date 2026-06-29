BEGIN;

-- Parent/Joueur sont deux sous-profils séparés sur le même compte.
-- Ces RPC prennent explicitement la fiche joueur active et vérifient que le
-- compte courant est soit le joueur lui-même, soit son parent/tuteur.

CREATE OR REPLACE FUNCTION private.user_can_access_player(
  p_player_id uuid,
  p_user_id uuid
) RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.players p
     WHERE p.id = p_player_id
       AND (
         p.user_id = p_user_id
         OR EXISTS (
           SELECT 1
             FROM public.player_guardians g
            WHERE g.player_id = p.id
              AND g.user_id = p_user_id
         )
       )
  );
$$;

DROP POLICY IF EXISTS players_read_pending_invitee ON public.players;
CREATE POLICY players_read_pending_invitee
  ON public.players FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.club_invitations i
       WHERE i.player_id = players.id
         AND i.kind IN ('player', 'guardian')
         AND i.status = 'pending'
         AND i.expires_at > now()
         AND (
           i.target_user_id = auth.uid()
           OR (
             i.email IS NOT NULL
             AND lower(i.email) = lower(auth.jwt() ->> 'email')
           )
         )
    )
  );

CREATE OR REPLACE FUNCTION public.player_match_callups_for_player(p_player_id uuid)
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
   WHERE private.user_can_access_player(p_player_id, auth.uid())
     AND mp.player_id = p_player_id
     AND mp.called_up = true
     AND m.convocation_sent_at IS NOT NULL
     AND m.starts_at >= now()
   ORDER BY m.starts_at ASC;
$$;

REVOKE ALL ON FUNCTION public.player_match_callups_for_player(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.player_match_callups_for_player(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_pending_invitations()
  RETURNS TABLE(
    invitation_id uuid,
    token text,
    club_id uuid,
    club_name text,
    role_id uuid,
    role_name text,
    access_level public.access_level,
    expires_at timestamptz,
    invited_by_name text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT
    i.id AS invitation_id,
    NULL::text AS token,
    c.id AS club_id,
    c.name AS club_name,
    r.id AS role_id,
    r.name AS role_name,
    r.access_level,
    i.expires_at,
    inviter.full_name AS invited_by_name
  FROM public.club_invitations i
  JOIN public.clubs c ON c.id = i.club_id
  LEFT JOIN public.club_roles r ON r.id = i.role_id
  LEFT JOIN public.profiles inviter ON inviter.id = i.invited_by
  LEFT JOIN auth.users u ON u.id = auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND i.kind = 'staff'
    AND i.status = 'pending'
    AND i.expires_at > now()
    AND (
      i.target_user_id = auth.uid()
      OR (i.email IS NOT NULL AND lower(i.email) = lower(u.email))
    )
  ORDER BY i.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.my_pending_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_pending_invitations() TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_session_for_player(
  p_session_id uuid,
  p_player_id  uuid,
  p_status     public.attendance_status,
  p_reason     text DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_team_id     uuid;
  v_club_id     uuid;
  v_session_at  timestamptz;
  v_deadline_h  integer;
  v_deadline_at timestamptz;
  v_id          uuid;
  v_reason      text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_status = 'absent' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'reason_required_when_absent';
  END IF;

  SELECT s.team_id,
         t.club_id,
         (s.date::timestamp + coalesce(s.start_time, time '00:00')) AT TIME ZONE 'UTC',
         s.rsvp_deadline_hours
    INTO v_team_id, v_club_id, v_session_at, v_deadline_h
    FROM public.sessions s
    JOIN public.teams    t ON t.id = s.team_id
   WHERE s.id = p_session_id;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  IF NOT private.club_is_active(v_club_id) THEN
    RAISE EXCEPTION 'club_inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.players p
      JOIN public.player_team_assignments pta ON pta.player_id = p.id
     WHERE p.id = p_player_id
       AND p.club_id = v_club_id
       AND pta.team_id = v_team_id
       AND private.user_can_access_player(p.id, v_user_id)
  ) THEN
    RAISE EXCEPTION 'not_assigned_to_team';
  END IF;

  v_deadline_at := v_session_at - make_interval(hours => coalesce(v_deadline_h, 24));
  IF now() > v_deadline_at THEN
    RAISE EXCEPTION 'deadline_passed';
  END IF;

  INSERT INTO public.session_attendances
    (session_id, player_id, announced_status, announced_reason, announced_at)
  VALUES
    (p_session_id, p_player_id, p_status, v_reason, now())
  ON CONFLICT (session_id, player_id) DO UPDATE
    SET announced_status = EXCLUDED.announced_status,
        announced_reason = EXCLUDED.announced_reason,
        announced_at     = EXCLUDED.announced_at
  RETURNING id INTO v_id;

  RETURN v_id;
END$$;

REVOKE ALL ON FUNCTION public.respond_to_session_for_player(uuid, uuid, public.attendance_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_session_for_player(uuid, uuid, public.attendance_status, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_match_for_player(
  p_match_id  uuid,
  p_player_id uuid,
  p_status    text,
  p_reason    text DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
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

  IF v_sent_at IS NULL THEN
    RAISE EXCEPTION 'not_called_up';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.players p
      JOIN public.player_team_assignments pta ON pta.player_id = p.id
     WHERE p.id = p_player_id
       AND p.club_id = v_club_id
       AND pta.team_id = v_team_id
       AND private.user_can_access_player(p.id, v_user_id)
  ) THEN
    RAISE EXCEPTION 'not_assigned_to_team';
  END IF;

  UPDATE public.match_participations
     SET availability        = p_status,
         availability_reason = v_reason,
         availability_at     = now()
   WHERE match_id = p_match_id
     AND player_id = p_player_id
     AND called_up = true
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'not_called_up';
  END IF;

  RETURN v_id;
END$$;

REVOKE ALL ON FUNCTION public.respond_to_match_for_player(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_match_for_player(uuid, uuid, text, text) TO authenticated;

COMMIT;
