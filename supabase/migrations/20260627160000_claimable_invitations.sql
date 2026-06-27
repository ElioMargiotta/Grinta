-- Lot B — Invitations réclamables (partage WhatsApp).
--
-- Problème : tout le flux d'invitation joueur était verrouillé sur l'email
-- (email NOT NULL, accept_invitation imposait email == JWT). Or les coachs
-- n'ont presque jamais l'email des joueurs ; le canal réel est WhatsApp.
--
-- Solution : l'email devient OPTIONNEL. Un lien devient RÉCLAMABLE — quiconque
-- est authentifié, ouvre le lien et CONFIRME son identité, rattache son compte
-- à la fiche pré-créée par le coach. Sécurité : token 192-bit (inchangé),
-- single-use (status passe à 'accepted'), expiry court, déliable côté coach
-- (Lot D), audit (accepted_by + club_invitation_events). Pas de email_mismatch.
--
-- accept_invitation(_by_id) restent pour les invitations email historiques
-- (carte /me). claim_invitation est le nouveau chemin canonique du lien.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. email nullable (+ CHECK tolérant le NULL)
-- ---------------------------------------------------------------------------
ALTER TABLE public.club_invitations
  ALTER COLUMN email DROP NOT NULL;

DO $$
DECLARE
  v_name text;
BEGIN
  SELECT conname INTO v_name
    FROM pg_constraint
   WHERE conrelid = 'public.club_invitations'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%length(btrim(email))%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.club_invitations DROP CONSTRAINT %I', v_name);
  END IF;
END$$;

ALTER TABLE public.club_invitations
  ADD CONSTRAINT club_invitations_email_nonempty
  CHECK (email IS NULL OR length(btrim(email)) > 0);

-- ---------------------------------------------------------------------------
-- 2. Rate-limit tolérant au NULL : on garde la limite par email quand il est
--    fourni (invitations staff/email), sinon on limite par (club, fiche joueur)
--    pour ne pas spammer la génération de liens réclamables.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.club_invitations_rate_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.email IS NOT NULL THEN
    SELECT count(*) INTO v_count
      FROM public.club_invitations
     WHERE club_id = NEW.club_id
       AND lower(email) = lower(NEW.email)
       AND status = 'pending'
       AND created_at > now() - interval '1 hour';
  ELSE
    SELECT count(*) INTO v_count
      FROM public.club_invitations
     WHERE club_id = NEW.club_id
       AND player_id IS NOT DISTINCT FROM NEW.player_id
       AND email IS NULL
       AND status = 'pending'
       AND created_at > now() - interval '1 hour';
  END IF;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'rate_limited'
      USING HINT = 'Too many pending invitations in the last hour.';
  END IF;
  RETURN NEW;
END$$;

-- ---------------------------------------------------------------------------
-- 3. RPC claim_invitation : réclamation d'un lien par le compte authentifié.
--    Pas de contrôle email (lien porteur). Single-use via FOR UPDATE + status.
--    kind=player : pose players.user_id (1 compte = 1 joueur / club).
--    kind=staff  : crée la membership.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_invitation(p_token text)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_inv      public.club_invitations;
  v_hash     text := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  v_other_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT * INTO v_inv
    FROM public.club_invitations
   WHERE token_hash = v_hash
   FOR UPDATE;

  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation_not_pending'; END IF;
  IF v_inv.expires_at < now() THEN
    UPDATE public.club_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'invitation_expired';
  END IF;
  IF NOT private.club_is_active(v_inv.club_id) THEN
    RAISE EXCEPTION 'club_inactive';
  END IF;

  IF v_inv.kind = 'staff' THEN
    INSERT INTO public.club_memberships (club_id, user_id, role_id)
    VALUES (v_inv.club_id, v_user_id, v_inv.role_id)
    ON CONFLICT DO NOTHING;
  ELSE
    -- 1 compte = 1 fiche joueur par club : refuse si le compte est déjà lié à
    -- une AUTRE fiche de ce club.
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

REVOKE ALL ON FUNCTION public.claim_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_invitation(text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
