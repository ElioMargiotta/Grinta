-- Invitation staff vers un compte existant (annuaire @username/email).

BEGIN;

CREATE OR REPLACE FUNCTION public.create_targeted_staff_invitation(
  p_club_id uuid,
  p_target_user_id uuid,
  p_email text,
  p_role_id uuid,
  p_team_ids uuid[] DEFAULT '{}'::uuid[],
  p_ttl_hours integer DEFAULT 168
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_token text;
  v_hash text;
  v_role record;
  v_team_id uuid;
  v_max int;
  v_admin boolean := public.is_platform_admin();
  v_invitation_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_target_user';
  END IF;

  IF NOT v_admin THEN
    IF private.user_club_access(p_club_id) NOT IN ('full'::public.access_level, 'extended'::public.access_level) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    IF NOT private.club_is_active(p_club_id) THEN
      RAISE EXCEPTION 'club_inactive';
    END IF;
  END IF;

  SELECT id, access_level INTO v_role
    FROM public.club_roles
   WHERE id = p_role_id AND club_id = p_club_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'role_not_in_club';
  END IF;

  IF v_role.access_level IN ('team', 'team_readonly')
     AND (p_team_ids IS NULL OR array_length(p_team_ids, 1) IS NULL) THEN
    RAISE EXCEPTION 'team_role_requires_team';
  END IF;

  SELECT max_staff INTO v_max FROM public.club_licenses WHERE club_id = p_club_id;
  IF v_max IS NOT NULL AND public.club_staff_count(p_club_id) >= v_max THEN
    RAISE EXCEPTION 'staff_quota_reached';
  END IF;

  v_team_id := (CASE
                  WHEN p_team_ids IS NOT NULL AND array_length(p_team_ids, 1) >= 1
                  THEN p_team_ids[1]
                  ELSE NULL
                END);

  v_token := replace(replace(replace(
              encode(extensions.gen_random_bytes(24), 'base64'),
              '+', '-'), '/', '_'), '=', '');
  v_hash := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');

  UPDATE public.club_invitations
     SET status = 'revoked'
   WHERE club_id = p_club_id
     AND kind = 'staff'
     AND target_user_id = p_target_user_id
     AND status = 'pending';

  INSERT INTO public.club_invitations
    (club_id, kind, email, target_user_id, token_hash, role_id, team_id, invited_by, expires_at)
  VALUES
    (p_club_id, 'staff', lower(nullif(p_email, '')), p_target_user_id, v_hash,
     p_role_id, v_team_id, auth.uid(), now() + (p_ttl_hours || ' hours')::interval)
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_targeted_staff_invitation(uuid, uuid, text, uuid, uuid[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_targeted_staff_invitation(uuid, uuid, text, uuid, uuid[], integer) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
