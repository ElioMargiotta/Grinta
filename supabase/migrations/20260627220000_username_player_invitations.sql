-- Stage 2 invitations joueur : ciblage par @username ou email.
--
-- Si le compte existe, l'invitation est liée à target_user_id et apparaît
-- directement dans son portail. Si seul l'email existe sans compte, on garde le
-- lien/email classique. Les liens réclamables sans cible restent possibles.

BEGIN;

ALTER TABLE public.club_invitations
  ADD COLUMN IF NOT EXISTS target_user_id uuid;

CREATE INDEX IF NOT EXISTS club_invitations_target_user_idx
  ON public.club_invitations (target_user_id)
  WHERE target_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS club_invitations_pending_target_user_uniq
  ON public.club_invitations (club_id, player_id, kind, target_user_id)
  WHERE status = 'pending'
    AND target_user_id IS NOT NULL
    AND player_id IS NOT NULL;

DROP POLICY IF EXISTS club_invitations_read_invitee ON public.club_invitations;
CREATE POLICY club_invitations_read_invitee
  ON public.club_invitations FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      target_user_id = auth.uid()
      OR (
        email IS NOT NULL
        AND lower(email) = lower(auth.jwt() ->> 'email')
      )
    )
  );

CREATE OR REPLACE FUNCTION public.resolve_invitation_target(p_identifier text)
  RETURNS TABLE(user_id uuid, email text, username text, full_name text)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_identifier text := lower(btrim(coalesce(p_identifier, '')));
BEGIN
  IF v_identifier = '' THEN
    RETURN;
  END IF;

  IF left(v_identifier, 1) = '@' THEN
    v_identifier := substr(v_identifier, 2);
  END IF;

  IF position('@' IN v_identifier) > 1 THEN
    RETURN QUERY
      SELECT u.id, lower(u.email), p.username, p.full_name
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
       WHERE lower(u.email) = v_identifier
       LIMIT 1;
  ELSE
    RETURN QUERY
      SELECT p.id, lower(u.email), p.username, p.full_name
        FROM public.profiles p
        LEFT JOIN auth.users u ON u.id = p.id
       WHERE lower(p.username) = v_identifier
       LIMIT 1;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_invitation_target(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_invitation_target(text) TO authenticated;

CREATE OR REPLACE FUNCTION private.current_user_matches_invitation(v_inv public.club_invitations)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_inv.target_user_id IS NOT NULL THEN
    RETURN v_inv.target_user_id = v_user_id;
  END IF;

  IF v_inv.email IS NULL THEN
    RETURN false;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  RETURN v_email IS NOT NULL AND lower(v_email) = lower(v_inv.email);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation_by_id(p_invitation_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inv public.club_invitations;
  v_other_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT * INTO v_inv
    FROM public.club_invitations
   WHERE id = p_invitation_id
   FOR UPDATE;

  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation_not_pending'; END IF;
  IF v_inv.expires_at < now() THEN
    UPDATE public.club_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'invitation_expired';
  END IF;
  IF NOT private.current_user_matches_invitation(v_inv) THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;
  IF NOT private.club_is_active(v_inv.club_id) THEN
    RAISE EXCEPTION 'club_inactive';
  END IF;

  IF v_inv.kind = 'staff' THEN
    INSERT INTO public.club_memberships (club_id, user_id, role_id)
    VALUES (v_inv.club_id, v_user_id, v_inv.role_id)
    ON CONFLICT DO NOTHING;

  ELSIF v_inv.kind = 'guardian' THEN
    INSERT INTO public.player_guardians (player_id, user_id)
    VALUES (v_inv.player_id, v_user_id)
    ON CONFLICT (player_id, user_id) DO NOTHING;

  ELSE
    SELECT id INTO v_other_id
      FROM public.players
     WHERE club_id = v_inv.club_id
       AND user_id = v_user_id
       AND id <> v_inv.player_id
     LIMIT 1;
    IF v_other_id IS NOT NULL THEN
      RAISE EXCEPTION 'already_linked_to_other_player';
    END IF;

    UPDATE public.players
       SET user_id = v_user_id
     WHERE id = v_inv.player_id
       AND (user_id IS NULL OR user_id = v_user_id);

    IF v_inv.team_id IS NOT NULL THEN
      INSERT INTO public.player_team_assignments (player_id, team_id)
      VALUES (v_inv.player_id, v_inv.team_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  UPDATE public.club_invitations
     SET status = 'accepted', accepted_by = v_user_id, accepted_at = now()
   WHERE id = v_inv.id;

  RETURN v_inv.id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation_by_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_invitation_by_id(p_invitation_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inv public.club_invitations;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT * INTO v_inv
    FROM public.club_invitations
   WHERE id = p_invitation_id
   FOR UPDATE;

  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation_not_pending'; END IF;
  IF NOT private.current_user_matches_invitation(v_inv) THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  UPDATE public.club_invitations
     SET status = 'revoked', accepted_by = v_user_id, accepted_at = now()
   WHERE id = v_inv.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_invitation_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_invitation_by_id(uuid) TO authenticated;

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

COMMIT;

NOTIFY pgrst, 'reload schema';
