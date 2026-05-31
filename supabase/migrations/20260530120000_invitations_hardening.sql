-- Invitations hardening:
--   - Replace plain `token` with `token_hash` (sha256 hex). The clear token only
--     lives in the URL we email; the DB stores only its hash so a DB leak can't
--     be used to accept invitations.
--   - Add email lifecycle columns (sent_at, provider_id, status) so the Resend
--     webhook can track delivery / bounces.
--   - New `club_invitation_events` audit table fed by the webhook.
--   - Rewrite get_invitation / accept_invitation / reject_invitation to hash
--     the input token before lookup.
--   - Rewrite legacy public.create_invitation to insert into the NEW schema
--     (the old shape with team_ids[] was dropped by 20260530111253). Returns
--     the cleartext token so the caller can build the URL + send the email.
--   - Add a per-(club_id, email) rate limit: max 5 pending invites per hour.
--
-- Runs after 20260530111253_club_invitations.sql (chronological order).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Columns: token_hash + email lifecycle
-- ---------------------------------------------------------------------------
ALTER TABLE public.club_invitations
  ADD COLUMN IF NOT EXISTS token_hash        text,
  ADD COLUMN IF NOT EXISTS email_sent_at     timestamptz,
  ADD COLUMN IF NOT EXISTS email_provider_id text,
  ADD COLUMN IF NOT EXISTS email_status      text
    NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending','sent','delivered','bounced','complained','failed','opened'));

-- Backfill token_hash for any existing rows (dev only — prod never had this table).
UPDATE public.club_invitations
   SET token_hash = encode(extensions.digest(convert_to(token, 'UTF8'), 'sha256'), 'hex')
 WHERE token_hash IS NULL
   AND token IS NOT NULL;

-- Drop the old uniqueness on `token` and remove the clear column.
DO $$
DECLARE
  v_uniq_name text;
BEGIN
  SELECT conname INTO v_uniq_name
    FROM pg_constraint
   WHERE conrelid = 'public.club_invitations'::regclass
     AND contype  = 'u'
     AND pg_get_constraintdef(oid) ILIKE '%(token)%';
  IF v_uniq_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.club_invitations DROP CONSTRAINT %I', v_uniq_name);
  END IF;
END$$;

ALTER TABLE public.club_invitations DROP COLUMN IF EXISTS token;

ALTER TABLE public.club_invitations
  ALTER COLUMN token_hash SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.club_invitations'::regclass
       AND conname  = 'club_invitations_token_hash_key'
  ) THEN
    ALTER TABLE public.club_invitations
      ADD CONSTRAINT club_invitations_token_hash_key UNIQUE (token_hash);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS club_invitations_email_status_idx
  ON public.club_invitations (email_status);
CREATE INDEX IF NOT EXISTS club_invitations_email_provider_idx
  ON public.club_invitations (email_provider_id)
  WHERE email_provider_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Rate limit helper + trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.invitation_rate_check(p_club_id uuid, p_email text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.club_invitations
   WHERE club_id = p_club_id
     AND lower(email) = lower(p_email)
     AND status = 'pending'
     AND created_at > now() - interval '1 hour';
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'rate_limited' USING HINT = 'Too many pending invitations for this email in the last hour.';
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.club_invitations_rate_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  PERFORM private.invitation_rate_check(NEW.club_id, NEW.email);
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS club_invitations_rate_limit_trg ON public.club_invitations;
CREATE TRIGGER club_invitations_rate_limit_trg
  BEFORE INSERT ON public.club_invitations
  FOR EACH ROW EXECUTE FUNCTION public.club_invitations_rate_limit();

-- ---------------------------------------------------------------------------
-- 3. Audit table: club_invitation_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.club_invitation_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.club_invitations(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_invitation_events_invitation_idx
  ON public.club_invitation_events (invitation_id);
CREATE INDEX IF NOT EXISTS club_invitation_events_created_idx
  ON public.club_invitation_events (created_at DESC);

ALTER TABLE public.club_invitation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS club_invitation_events_read_admin ON public.club_invitation_events;
CREATE POLICY club_invitation_events_read_admin
  ON public.club_invitation_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_invitations i
       WHERE i.id = club_invitation_events.invitation_id
         AND private.user_club_access(i.club_id)
             = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level])
    )
  );

-- No INSERT/UPDATE/DELETE policy: writes go through the webhook route with
-- the service-role key (bypasses RLS).

-- ---------------------------------------------------------------------------
-- 4. Rewrite get_invitation / accept_invitation / reject_invitation
--    to look up by token hash instead of the plain token.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_invitation(text);
CREATE OR REPLACE FUNCTION public.get_invitation(p_token text)
  RETURNS TABLE (
    id          uuid,
    club_id     uuid,
    club_name   text,
    kind        public.invitation_kind,
    email       text,
    role_name   text,
    player_first_name text,
    player_last_name  text,
    team_name   text,
    status      public.invitation_status,
    expires_at  timestamptz
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT
    i.id,
    i.club_id,
    c.name AS club_name,
    i.kind,
    i.email,
    r.name AS role_name,
    p.first_name AS player_first_name,
    p.last_name  AS player_last_name,
    t.name AS team_name,
    CASE
      WHEN i.status = 'pending' AND i.expires_at < now() THEN 'expired'::public.invitation_status
      ELSE i.status
    END AS status,
    i.expires_at
  FROM public.club_invitations i
  JOIN public.clubs c ON c.id = i.club_id
  LEFT JOIN public.club_roles r ON r.id = i.role_id
  LEFT JOIN public.players p    ON p.id = i.player_id
  LEFT JOIN public.teams t      ON t.id = i.team_id
  WHERE i.token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.accept_invitation(text);
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT * INTO v_inv
    FROM public.club_invitations
   WHERE token_hash = v_hash
   FOR UPDATE;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'invitation_not_pending';
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE public.club_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'invitation_expired';
  END IF;

  IF lower(v_user_email) <> lower(v_inv.email) THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  IF NOT private.club_is_active(v_inv.club_id) THEN
    RAISE EXCEPTION 'club_inactive';
  END IF;

  IF v_inv.kind = 'staff' THEN
    INSERT INTO public.club_memberships (club_id, user_id, role_id)
    VALUES (v_inv.club_id, v_user_id, v_inv.role_id)
    ON CONFLICT DO NOTHING;
  ELSE
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

REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

DROP FUNCTION IF EXISTS public.reject_invitation(text);
CREATE OR REPLACE FUNCTION public.reject_invitation(p_token text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_user_email text;
  v_inv        public.club_invitations;
  v_hash       text := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  SELECT * INTO v_inv FROM public.club_invitations WHERE token_hash = v_hash FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation_not_pending'; END IF;
  IF lower(v_user_email) <> lower(v_inv.email) THEN RAISE EXCEPTION 'email_mismatch'; END IF;
  UPDATE public.club_invitations
     SET status = 'revoked', accepted_by = v_user_id, accepted_at = now()
   WHERE id = v_inv.id;
END$$;

REVOKE ALL ON FUNCTION public.reject_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_invitation(text) TO authenticated;

-- accept_invitation_by_id / reject_invitation_by_id — used by the /me UI
-- where the invitee already saw the row via the invitee SELECT RLS policy
-- (which matches their JWT email against the invitation email). The token
-- isn't available there (the cleartext only lives in the URL), so we look
-- up by id and re-verify the email match inside the function.
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

REVOKE ALL ON FUNCTION public.accept_invitation_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation_by_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_invitation_by_id(p_invitation_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_user_email text;
  v_inv        public.club_invitations;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  SELECT * INTO v_inv FROM public.club_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation_not_pending'; END IF;
  IF lower(v_user_email) <> lower(v_inv.email) THEN RAISE EXCEPTION 'email_mismatch'; END IF;
  UPDATE public.club_invitations
     SET status = 'revoked', accepted_by = v_user_id, accepted_at = now()
   WHERE id = v_inv.id;
END$$;

REVOKE ALL ON FUNCTION public.reject_invitation_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_invitation_by_id(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Rewrite legacy public.create_invitation for the new schema.
--    Returns the cleartext token (only place it exists) so the caller can
--    build the URL + send the Resend email.
--    Kept signature with p_team_ids uuid[] for source compatibility with
--    ClubSettings.tsx; we use the first element as the new single team_id.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_invitation(uuid, text, uuid, uuid[], integer);

CREATE OR REPLACE FUNCTION public.create_invitation(
  p_club_id   uuid,
  p_email     text,
  p_role_id   uuid,
  p_team_ids  uuid[] DEFAULT '{}'::uuid[],
  p_ttl_hours integer DEFAULT 168
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_token   text;
  v_hash    text;
  v_role    record;
  v_team_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF private.user_club_access(p_club_id) NOT IN ('full'::public.access_level, 'extended'::public.access_level) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT private.club_is_active(p_club_id) THEN
    RAISE EXCEPTION 'club_inactive';
  END IF;

  SELECT id, access_level INTO v_role
    FROM public.club_roles
   WHERE id = p_role_id AND club_id = p_club_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'role_not_in_club';
  END IF;

  IF v_role.access_level IN ('team','team_readonly') AND (p_team_ids IS NULL OR array_length(p_team_ids,1) IS NULL) THEN
    RAISE EXCEPTION 'team_role_requires_team';
  END IF;

  v_team_id := (CASE
                  WHEN p_team_ids IS NOT NULL AND array_length(p_team_ids,1) >= 1
                  THEN p_team_ids[1]
                  ELSE NULL
                END);

  -- 192 bits, base64url-safe.
  v_token := replace(replace(replace(
              encode(extensions.gen_random_bytes(24), 'base64'),
              '+','-'), '/','_'), '=','');
  v_hash  := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');

  -- Mark older pending invites for the same (club, email) as revoked so the
  -- rate-limit trigger doesn't trip the new one. Keeps a clean audit trail.
  UPDATE public.club_invitations
     SET status = 'revoked'
   WHERE club_id = p_club_id
     AND lower(email) = lower(p_email)
     AND status = 'pending';

  INSERT INTO public.club_invitations
    (club_id, kind, email, token_hash, role_id, team_id, invited_by, expires_at)
  VALUES
    (p_club_id, 'staff', lower(p_email), v_hash, p_role_id, v_team_id, auth.uid(),
     now() + (p_ttl_hours || ' hours')::interval);

  RETURN v_token;
END$$;

REVOKE ALL ON FUNCTION public.create_invitation(uuid, text, uuid, uuid[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invitation(uuid, text, uuid, uuid[], integer) TO authenticated;

COMMIT;
