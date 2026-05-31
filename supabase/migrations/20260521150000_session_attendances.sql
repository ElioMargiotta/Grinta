-- Issue #41 — Présences entraînement (RSVP joueur + validation coach)
--
-- Modèle :
--   1. sessions.rsvp_deadline_hours : combien d'heures avant la séance le
--      joueur doit avoir confirmé. Default 24h, modifiable par le coach.
--   2. session_attendances : une row par (session, player).
--        - announced_status / announced_reason / announced_at : le joueur
--          répond à la convocation (raison obligatoire si absent).
--        - actual_status / actual_marked_at / actual_marked_by : le coach
--          marque la présence réelle après la séance.
--
-- Accès :
--   - Joueur : écrit via la RPC `respond_to_session` (SECURITY DEFINER) qui
--     enforce la deadline + la justification absence + le rattachement
--     équipe. Il peut lire sa propre row.
--   - Coach (staff team/extended/full) : lit/écrit toutes les rows des
--     séances du club. Écrit `actual_*` directement via UPDATE.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. enum statut de présence
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE public.attendance_status AS ENUM ('present', 'absent');
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 2. sessions.rsvp_deadline_hours
-- ---------------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS rsvp_deadline_hours integer NOT NULL DEFAULT 24
    CHECK (rsvp_deadline_hours >= 0 AND rsvp_deadline_hours <= 168);

COMMENT ON COLUMN public.sessions.rsvp_deadline_hours IS
  'Délai (heures) avant le début de la séance jusqu''auquel le joueur peut modifier sa réponse. 0 = jusqu''au début. Max 168 (7j).';

-- ---------------------------------------------------------------------------
-- 3. session_attendances
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_attendances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id         uuid NOT NULL REFERENCES public.players(id)  ON DELETE CASCADE,

  announced_status  public.attendance_status,
  announced_reason  text,
  announced_at      timestamptz,

  actual_status     public.attendance_status,
  actual_marked_at  timestamptz,
  actual_marked_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT session_attendances_unique UNIQUE (session_id, player_id),
  CONSTRAINT session_attendances_reason_when_absent CHECK (
    announced_status IS DISTINCT FROM 'absent'
    OR (announced_reason IS NOT NULL AND length(btrim(announced_reason)) > 0)
  ),
  CONSTRAINT session_attendances_reason_length CHECK (
    announced_reason IS NULL OR length(announced_reason) <= 500
  )
);

CREATE INDEX IF NOT EXISTS session_attendances_session_idx
  ON public.session_attendances (session_id);
CREATE INDEX IF NOT EXISTS session_attendances_player_idx
  ON public.session_attendances (player_id);

-- trigger updated_at
CREATE OR REPLACE FUNCTION public.set_session_attendances_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS session_attendances_set_updated_at ON public.session_attendances;
CREATE TRIGGER session_attendances_set_updated_at
  BEFORE UPDATE ON public.session_attendances
  FOR EACH ROW EXECUTE FUNCTION public.set_session_attendances_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_attendances ENABLE ROW LEVEL SECURITY;

-- 4.a Joueur : lire sa propre row
DROP POLICY IF EXISTS session_attendances_read_self ON public.session_attendances;
CREATE POLICY session_attendances_read_self
  ON public.session_attendances FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.players p
     WHERE p.id = session_attendances.player_id
       AND p.user_id = (SELECT auth.uid())
  ));

-- 4.b Staff : lire toutes les rows des séances de son club
DROP POLICY IF EXISTS session_attendances_read_staff ON public.session_attendances;
CREATE POLICY session_attendances_read_staff
  ON public.session_attendances FOR SELECT
  USING (EXISTS (
    SELECT 1
      FROM public.sessions s
      JOIN public.teams t ON t.id = s.team_id
     WHERE s.id = session_attendances.session_id
       AND private.user_club_access(t.club_id) IS NOT NULL
  ));

-- 4.c Staff : INSERT/UPDATE/DELETE pour les séances de son club (writes
--     directes pour actual_*). Le joueur passe par la RPC.
DROP POLICY IF EXISTS session_attendances_write_staff ON public.session_attendances;
CREATE POLICY session_attendances_write_staff
  ON public.session_attendances FOR ALL
  USING (EXISTS (
    SELECT 1
      FROM public.sessions s
      JOIN public.teams t ON t.id = s.team_id
     WHERE s.id = session_attendances.session_id
       AND private.user_club_access(t.club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])
       AND private.club_is_active(t.club_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1
      FROM public.sessions s
      JOIN public.teams t ON t.id = s.team_id
     WHERE s.id = session_attendances.session_id
       AND private.user_club_access(t.club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])
       AND private.club_is_active(t.club_id)
  ));

-- ---------------------------------------------------------------------------
-- 5. RPC respond_to_session : entrée d'écriture côté joueur
--    SECURITY DEFINER pour by-pass RLS proprement et appliquer les
--    contraintes métier (deadline, justification, rattachement équipe).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_to_session(
  p_session_id uuid,
  p_status     public.attendance_status,
  p_reason     text DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_player_id   uuid;
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

  -- Le joueur doit avoir une fiche dans ce club ET être affecté à l'équipe
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

  v_deadline_at := v_session_at - make_interval(hours => coalesce(v_deadline_h, 24));
  IF now() > v_deadline_at THEN
    RAISE EXCEPTION 'deadline_passed';
  END IF;

  INSERT INTO public.session_attendances
    (session_id, player_id, announced_status, announced_reason, announced_at)
  VALUES
    (p_session_id, v_player_id, p_status, v_reason, now())
  ON CONFLICT (session_id, player_id) DO UPDATE
    SET announced_status = EXCLUDED.announced_status,
        announced_reason = EXCLUDED.announced_reason,
        announced_at     = EXCLUDED.announced_at
  RETURNING id INTO v_id;

  RETURN v_id;
END$$;

REVOKE ALL ON FUNCTION public.respond_to_session(uuid, public.attendance_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_session(uuid, public.attendance_status, text) TO authenticated;

COMMIT;
