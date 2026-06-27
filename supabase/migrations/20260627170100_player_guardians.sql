-- Lot C — Modèle parent / tuteur.
--
-- Deux relations distinctes et non exclusives d'un compte à une fiche joueur :
--   1. SELF     → players.user_id (le joueur lui-même) — inchangé.
--   2. GUARDIAN → player_guardians (un parent gère une/plusieurs fiches).
-- N tuteurs → 1 fiche ; 1 tuteur → N fiches (fratrie). Les notifications de
-- convocation sont routées vers SELF ∪ GUARDIANS.
--
-- « Toujours les deux possibles » (décision produit) : pas de seuil d'âge dur ;
-- le coach choisit la cible (joueur / parent) à l'invitation.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Helper : club d'une fiche joueur, en SECURITY DEFINER (contourne la RLS
--    de players pour être utilisable dans les policies sans récursion).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.player_club_id(p_player_id uuid)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT club_id FROM public.players WHERE id = p_player_id
$$;

-- ---------------------------------------------------------------------------
-- 1. Table player_guardians
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_guardians (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid NOT NULL REFERENCES public.players(id)  ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relation   text NOT NULL DEFAULT 'guardian'
    CHECK (relation IN ('guardian', 'parent', 'mother', 'father', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_guardians_unique UNIQUE (player_id, user_id)
);

CREATE INDEX IF NOT EXISTS player_guardians_player_idx ON public.player_guardians (player_id);
CREATE INDEX IF NOT EXISTS player_guardians_user_idx   ON public.player_guardians (user_id);

COMMENT ON TABLE public.player_guardians IS
  'Lien parent/tuteur → fiche joueur (Lot C). Distinct de players.user_id (self).';

-- Cap souple : max 5 tuteurs par fiche.
CREATE OR REPLACE FUNCTION public.player_guardians_cap()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.player_guardians
   WHERE player_id = NEW.player_id;
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'too_many_guardians';
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS player_guardians_cap_trg ON public.player_guardians;
CREATE TRIGGER player_guardians_cap_trg
  BEFORE INSERT ON public.player_guardians
  FOR EACH ROW EXECUTE FUNCTION public.player_guardians_cap();

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.player_guardians ENABLE ROW LEVEL SECURITY;

-- Le staff du club (full/extended) gère les liens tuteur de ses fiches.
DROP POLICY IF EXISTS player_guardians_manage_staff ON public.player_guardians;
CREATE POLICY player_guardians_manage_staff
  ON public.player_guardians FOR ALL
  USING (
    private.user_club_access(private.player_club_id(player_id))
      = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level])
  )
  WITH CHECK (
    private.user_club_access(private.player_club_id(player_id))
      = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level])
    AND private.club_is_active(private.player_club_id(player_id))
  );

-- Le tuteur lit ses propres liens ; le joueur (self) lit les tuteurs de SA fiche.
DROP POLICY IF EXISTS player_guardians_read_self ON public.player_guardians;
CREATE POLICY player_guardians_read_self
  ON public.player_guardians FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.players p
       WHERE p.id = player_guardians.player_id
         AND p.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.player_guardians TO authenticated;
GRANT ALL ON TABLE public.player_guardians TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Invitations : autoriser kind='guardian' (même forme que 'player').
-- ---------------------------------------------------------------------------
ALTER TABLE public.club_invitations
  DROP CONSTRAINT IF EXISTS club_invitations_kind_consistency;
ALTER TABLE public.club_invitations
  ADD CONSTRAINT club_invitations_kind_consistency CHECK (
    (kind = 'staff'  AND role_id   IS NOT NULL AND player_id IS NULL)
    OR
    (kind IN ('player','guardian') AND player_id IS NOT NULL AND role_id IS NULL)
  );

-- ---------------------------------------------------------------------------
-- 4. claim_invitation : branche guardian → INSERT player_guardians (idempotent,
--    cap géré par trigger). On conserve les branches staff/player.
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
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

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

  ELSIF v_inv.kind = 'guardian' THEN
    INSERT INTO public.player_guardians (player_id, user_id)
    VALUES (v_inv.player_id, v_user_id)
    ON CONFLICT (player_id, user_id) DO NOTHING;

  ELSE  -- 'player' (self)
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

-- ---------------------------------------------------------------------------
-- 5. Notifs convocation : router vers SELF ∪ GUARDIANS. Un destinataire =
--    un compte (self du joueur OU un tuteur). Idempotence par (match, compte).
-- ---------------------------------------------------------------------------
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

  IF private.user_team_access(v_team_id) IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_sent_at IS NULL THEN
    RETURN 0;
  END IF;

  -- Destinataires = compte self du joueur ∪ comptes tuteurs, pour chaque joueur
  -- convoqué (called_up). DISTINCT pour ne pas dédoubler si self = tuteur.
  FOR r IN
    WITH called AS (
      SELECT p.id AS player_id, p.user_id AS self_user_id,
             m.id AS match_id, m.team_id, t.name AS team_name,
             m.starts_at, m.opponent, m.location, m.kind, m.home_away
        FROM public.match_participations mp
        JOIN public.players p      ON p.id = mp.player_id
        JOIN public.team_matches m ON m.id = mp.match_id
        JOIN public.teams t        ON t.id = m.team_id
       WHERE mp.match_id = p_match_id
         AND mp.called_up = true
    ),
    recipients AS (
      SELECT self_user_id AS user_id, match_id, team_id, team_name,
             starts_at, opponent, location, kind, home_away
        FROM called WHERE self_user_id IS NOT NULL
      UNION
      SELECT g.user_id, c.match_id, c.team_id, c.team_name,
             c.starts_at, c.opponent, c.location, c.kind, c.home_away
        FROM called c
        JOIN public.player_guardians g ON g.player_id = c.player_id
    )
    SELECT DISTINCT user_id, match_id, team_id, team_name,
           starts_at, opponent, location, kind, home_away
      FROM recipients
  LOOP
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
