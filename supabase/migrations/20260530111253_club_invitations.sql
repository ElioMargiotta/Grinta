-- Issue #X — Invitations club (joueur / staff)
--
-- Modèle :
--   - club_invitations : un coach (access_level full/extended) génère un
--     lien d'invitation pour une adresse email. kind='player' rattache un
--     `players` row existant (créé via /contingent) à l'auth.users qui
--     accepte. kind='staff' crée un club_memberships avec un role_id donné.
--   - token : string url-safe (gen_random_uuid hex), unique global.
--   - expires_at : 14 jours par défaut.
--
-- Accès :
--   - Coach (full/extended) : CRUD invitations de son club.
--   - Utilisateur destinataire : pas d'accès direct à la table. Lecture via
--     RPC `get_invitation(token)` (SECURITY DEFINER), acceptation via RPC
--     `accept_invitation(token)` (SECURITY DEFINER).

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Drop legacy shape (dev had an older club_invitations from a reverted
--    push: role_id NOT NULL, team_ids[], no kind/status/player_id). Prod
--    never had this table, so the DROP is a no-op there.
--    Also drop preview_invitation — replaced by get_invitation below, and
--    its body referenced the old column shape.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='club_invitations'
       AND column_name='team_ids'
  ) THEN
    DROP TABLE public.club_invitations CASCADE;
  END IF;
END$$;

DROP FUNCTION IF EXISTS public.preview_invitation(text);

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_kind') THEN
    CREATE TYPE public.invitation_kind AS ENUM ('staff', 'player');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status') THEN
    CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.club_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  kind         public.invitation_kind NOT NULL,
  email        text NOT NULL CHECK (length(btrim(email)) > 0),
  token        text NOT NULL UNIQUE,

  -- staff invites only
  role_id      uuid REFERENCES public.club_roles(id) ON DELETE CASCADE,

  -- player invites only
  player_id    uuid REFERENCES public.players(id) ON DELETE CASCADE,
  team_id      uuid REFERENCES public.teams(id)   ON DELETE SET NULL,

  status       public.invitation_status NOT NULL DEFAULT 'pending',
  -- invited_by / accepted_by store auth.users(id) values but intentionally do
  -- NOT carry a foreign key: the `authenticated` role has no REFERENCES
  -- privilege on auth.users, so FK validation would block client-side
  -- INSERT/UPDATE through PostgREST. Treat them as audit columns.
  invited_by   uuid,
  accepted_by  uuid,
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '14 days'),

  CONSTRAINT club_invitations_kind_consistency CHECK (
    (kind = 'staff'  AND role_id   IS NOT NULL AND player_id IS NULL)
    OR
    (kind = 'player' AND player_id IS NOT NULL AND role_id   IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS club_invitations_club_idx        ON public.club_invitations (club_id);
CREATE INDEX IF NOT EXISTS club_invitations_email_idx       ON public.club_invitations (lower(email));
CREATE INDEX IF NOT EXISTS club_invitations_status_idx      ON public.club_invitations (status);
CREATE INDEX IF NOT EXISTS club_invitations_player_idx      ON public.club_invitations (player_id);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS club_invitations_manage_staff ON public.club_invitations;
CREATE POLICY club_invitations_manage_staff
  ON public.club_invitations FOR ALL
  USING (
    private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level])
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level])
    AND private.club_is_active(club_id)
  );

-- Invitee can read their own pending invitations (lookup by the email on the
-- invitation matching the auth user's email). Used to list incoming invites
-- on /me without exposing other clubs' invitation rows.
-- Note: we read the email from the JWT (`auth.jwt() ->> 'email'`) rather than
-- joining `auth.users`. The `authenticated` role doesn't have SELECT on
-- `auth.users`, and any RLS-touched SELECT during an INSERT's RETURNING clause
-- would otherwise fail with "permission denied for table users".
DROP POLICY IF EXISTS club_invitations_read_invitee ON public.club_invitations;
CREATE POLICY club_invitations_read_invitee
  ON public.club_invitations FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND lower(email) = lower(auth.jwt() ->> 'email')
  );

-- ---------------------------------------------------------------------------
-- 4. RPC get_invitation — public read by token
-- ---------------------------------------------------------------------------
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
  WHERE i.token = p_token
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC accept_invitation
-- ---------------------------------------------------------------------------
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
   WHERE token = p_token
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

-- ---------------------------------------------------------------------------
-- 6. RPC reject_invitation
-- ---------------------------------------------------------------------------
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
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  SELECT * INTO v_inv FROM public.club_invitations WHERE token = p_token FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation_not_pending'; END IF;
  IF lower(v_user_email) <> lower(v_inv.email) THEN RAISE EXCEPTION 'email_mismatch'; END IF;
  UPDATE public.club_invitations
     SET status = 'revoked', accepted_by = v_user_id, accepted_at = now()
   WHERE id = v_inv.id;
END$$;

REVOKE ALL ON FUNCTION public.reject_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_invitation(text) TO authenticated;

COMMIT;
