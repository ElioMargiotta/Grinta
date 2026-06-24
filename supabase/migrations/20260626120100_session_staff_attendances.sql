-- Issue #59 — Pointage de présence des moniteurs/staff par séance.
--
-- Pendant de `session_attendances` (joueurs) pour l'encadrement : une row par
-- (séance, membre du staff). Sert l'export BDNS (lignes FONCTION = moniteur/trice).
-- Le staff d'une équipe = `team_memberships` → `club_memberships`.
--
-- Accès calqué sur `session_attendances` (staff team/extended/full du club de la
-- séance lit/écrit). Réutilise l'enum `public.attendance_status` ('present'/'absent').
-- Additif, schéma public uniquement.

BEGIN;

CREATE TABLE IF NOT EXISTS public.session_staff_attendances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES public.sessions(id)         ON DELETE CASCADE,
  membership_id  uuid NOT NULL REFERENCES public.club_memberships(id) ON DELETE CASCADE,

  actual_status     public.attendance_status,
  actual_marked_at  timestamptz,
  actual_marked_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT session_staff_attendances_unique UNIQUE (session_id, membership_id)
);

CREATE INDEX IF NOT EXISTS session_staff_attendances_session_idx
  ON public.session_staff_attendances (session_id);
CREATE INDEX IF NOT EXISTS session_staff_attendances_membership_idx
  ON public.session_staff_attendances (membership_id);

-- trigger updated_at
CREATE OR REPLACE FUNCTION public.set_session_staff_attendances_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS session_staff_attendances_set_updated_at ON public.session_staff_attendances;
CREATE TRIGGER session_staff_attendances_set_updated_at
  BEFORE UPDATE ON public.session_staff_attendances
  FOR EACH ROW EXECUTE FUNCTION public.set_session_staff_attendances_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — staff du club de la séance (lecture + écriture)
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_staff_attendances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_staff_attendances_read_staff ON public.session_staff_attendances;
CREATE POLICY session_staff_attendances_read_staff
  ON public.session_staff_attendances FOR SELECT
  USING (EXISTS (
    SELECT 1
      FROM public.sessions s
      JOIN public.teams t ON t.id = s.team_id
     WHERE s.id = session_staff_attendances.session_id
       AND private.user_club_access(t.club_id) IS NOT NULL
  ));

DROP POLICY IF EXISTS session_staff_attendances_write_staff ON public.session_staff_attendances;
CREATE POLICY session_staff_attendances_write_staff
  ON public.session_staff_attendances FOR ALL
  USING (EXISTS (
    SELECT 1
      FROM public.sessions s
      JOIN public.teams t ON t.id = s.team_id
     WHERE s.id = session_staff_attendances.session_id
       AND private.user_club_access(t.club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])
       AND private.club_is_active(t.club_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1
      FROM public.sessions s
      JOIN public.teams t ON t.id = s.team_id
     WHERE s.id = session_staff_attendances.session_id
       AND private.user_club_access(t.club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])
       AND private.club_is_active(t.club_id)
  ));

GRANT ALL ON TABLE public.session_staff_attendances TO anon;
GRANT ALL ON TABLE public.session_staff_attendances TO authenticated;
GRANT ALL ON TABLE public.session_staff_attendances TO service_role;

-- ---------------------------------------------------------------------------
-- RPC list_team_staff : liste l'encadrement d'une équipe (moniteurs/staff).
--   `club_memberships` n'est lisible qu'en full/extended ; un coach d'équipe
--   (`team`) doit pourtant voir ses moniteurs pour le pointage + l'export BDNS.
--   SECURITY DEFINER, mais le filtre `user_club_access(...) IS NOT NULL`
--   (évalué avec l'auth.uid() de l'appelant) enferme l'accès au club.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_team_staff(p_team_id uuid)
  RETURNS TABLE (membership_id uuid, user_id uuid, full_name text, js_number text)
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT cm.id, cm.user_id, pr.full_name, cm.js_number
    FROM public.team_memberships tm
    JOIN public.club_memberships cm ON cm.id = tm.membership_id
    JOIN public.teams t            ON t.id  = tm.team_id
    LEFT JOIN public.profiles pr   ON pr.id = cm.user_id
   WHERE tm.team_id = p_team_id
     AND private.user_club_access(t.club_id) IS NOT NULL
   ORDER BY pr.full_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.list_team_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_team_staff(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC set_membership_js_number : renseigner/corriger le N° J+S d'un moniteur.
--   Autorisé au staff team/extended/full du club (club actif).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_membership_js_number(
  p_membership_id uuid,
  p_js_number     text
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_club_id uuid;
  v_access  public.access_level;
  v_clean   text := nullif(btrim(coalesce(p_js_number, '')), '');
BEGIN
  SELECT club_id INTO v_club_id FROM public.club_memberships WHERE id = p_membership_id;
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'membership_not_found';
  END IF;
  v_access := private.user_club_access(v_club_id);
  IF v_access IS NULL OR v_access NOT IN ('full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT private.club_is_active(v_club_id) THEN
    RAISE EXCEPTION 'club_inactive';
  END IF;
  UPDATE public.club_memberships SET js_number = v_clean WHERE id = p_membership_id;
END$$;

REVOKE ALL ON FUNCTION public.set_membership_js_number(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_membership_js_number(uuid, text) TO authenticated;

COMMIT;
