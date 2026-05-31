-- Enforce "one user account = one player profile per club" on the accept path.
--
-- Background: players has a unique index (club_id, user_id) WHERE user_id
-- IS NOT NULL (migration 20260519200123). Before this migration, accepting a
-- second player-invite for a different player row in the same club bubbled
-- the raw 23505 unique_violation up to the action, which the UI surfaced as
-- a generic "rpc_error" — looked like the Accept button did nothing.
--
-- Fix: pre-check the constraint inside the RPC, raise a clean
-- 'already_linked_to_other_player' exception that the UI can translate, and
-- short-circuit the UPDATE so the constraint never throws raw.

BEGIN;

-- accept_invitation (token flow — used by /invite/{token})
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_user_email text;
  v_inv        public.club_invitations;
  v_hash       text := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  v_other_id   uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT * INTO v_inv FROM public.club_invitations WHERE token_hash = v_hash FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation_not_pending'; END IF;
  IF v_inv.expires_at < now() THEN
    UPDATE public.club_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'invitation_expired';
  END IF;
  IF lower(v_user_email) <> lower(v_inv.email) THEN RAISE EXCEPTION 'email_mismatch'; END IF;
  IF NOT private.club_is_active(v_inv.club_id) THEN RAISE EXCEPTION 'club_inactive'; END IF;

  IF v_inv.kind = 'staff' THEN
    INSERT INTO public.club_memberships (club_id, user_id, role_id)
    VALUES (v_inv.club_id, v_user_id, v_inv.role_id)
    ON CONFLICT DO NOTHING;
  ELSE
    -- Enforce 1 user = 1 player per club. Find any existing player in this
    -- club already attached to this user (excluding the target row itself).
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
END$$;

-- accept_invitation_by_id (id flow — used by PendingInvitationsCard on /me)
CREATE OR REPLACE FUNCTION public.accept_invitation_by_id(p_invitation_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_user_email text;
  v_inv        public.club_invitations;
  v_other_id   uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT * INTO v_inv FROM public.club_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation_not_pending'; END IF;
  IF v_inv.expires_at < now() THEN
    UPDATE public.club_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'invitation_expired';
  END IF;
  IF lower(v_user_email) <> lower(v_inv.email) THEN RAISE EXCEPTION 'email_mismatch'; END IF;
  IF NOT private.club_is_active(v_inv.club_id) THEN RAISE EXCEPTION 'club_inactive'; END IF;

  IF v_inv.kind = 'staff' THEN
    INSERT INTO public.club_memberships (club_id, user_id, role_id)
    VALUES (v_inv.club_id, v_user_id, v_inv.role_id)
    ON CONFLICT DO NOTHING;
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
END$$;

-- Helper used by createPlayerInviteAction to fail-fast at invite time when
-- the targeted player would have to link to a user already linked elsewhere
-- in this club. Returns the id of the existing player linked to the email
-- in this club (excluding p_player_id), or NULL if free.
CREATE OR REPLACE FUNCTION public.player_email_already_linked_in_club(
  p_club_id   uuid,
  p_email     text,
  p_player_id uuid
)
  RETURNS uuid
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT p.id
    FROM public.players p
    JOIN auth.users u ON u.id = p.user_id
   WHERE p.club_id = p_club_id
     AND lower(u.email) = lower(p_email)
     AND p.id <> p_player_id
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.player_email_already_linked_in_club(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.player_email_already_linked_in_club(uuid, text, uuid) TO authenticated;

COMMIT;
