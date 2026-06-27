-- Lot 1 — Notification Hub (fondation).
--
-- Première brique du "hub" de communication de Grinta : une boîte de réception
-- in-app, event-driven et multi-tenant. Aucun système de notification
-- n'existait avant. Le modèle est volontairement générique : une row =
-- une notification destinée à UN compte (`user_id`), discriminée par `type`,
-- avec un `payload` jsonb porteur du contexte (match, invitation, éval…).
--
-- Le même événement métier (ex. envoi d'une convocation) se matérialise en N
-- rows — une par destinataire. Le rendu côté client est adapté au rôle : un
-- `type` se lit différemment côté entraîneur (émetteur / suivi) et côté joueur
-- (action à faire). La table ne tranche pas le rôle ; elle livre à un compte.
--
-- Sécurité : les notifications ne sont JAMAIS insérées par un client. Elles
-- sont émises par des fonctions SECURITY DEFINER (`private.emit_notification`)
-- appelées depuis les flux métier. RLS n'autorise que la LECTURE par le
-- destinataire ; le marquage "lu" passe par des RPC dédiées. Additif, schéma
-- public uniquement.

BEGIN;

CREATE TABLE IF NOT EXISTS public.notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Destinataire. La notification est livrée à un COMPTE, pas à un rôle :
  -- le même événement fan-out vers plusieurs user_id.
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Club concerné (théming + filtrage). NULL pour les notifs hors club
  -- (ex. invitation à rejoindre un club que l'utilisateur n'a pas encore).
  club_id        uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  -- Discriminant de rendu/action : 'match_convocation', 'invitation',
  -- 'evaluation_shared', 'announcement', 'license'…
  type           text NOT NULL,
  -- Contexte sérialisé : ids + libellés nécessaires au rendu sans round-trip.
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Qui a déclenché la notif (souvent un staff). NULL = système.
  actor_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- État "lu" : NULL = non lu. Le marquage passe par les RPC ci-dessous.
  read_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Inbox : tri anté-chronologique par destinataire.
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
-- Badge "non lus" : index partiel compact.
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id)
  WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS — le destinataire lit ses notifications, point. Aucune policy d'écriture :
-- INSERT/UPDATE/DELETE direct sont refusés (default-deny). L'émission passe par
-- private.emit_notification (DEFINER) et le marquage par les RPC dédiées.
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_read_self ON public.notifications;
CREATE POLICY notifications_read_self
  ON public.notifications FOR SELECT
  USING (user_id = (SELECT auth.uid()));

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

-- ---------------------------------------------------------------------------
-- private.emit_notification : seul point d'entrée d'écriture. Appelé par les
-- fonctions métier (elles-mêmes DEFINER) et de futurs triggers. No-op si le
-- destinataire est NULL (ex. joueur sans compte lié). Renvoie l'id créé.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.emit_notification(
  p_user_id       uuid,
  p_type          text,
  p_payload       jsonb DEFAULT '{}'::jsonb,
  p_club_id       uuid  DEFAULT NULL,
  p_actor_user_id uuid  DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_type IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, payload, club_id, actor_user_id)
  VALUES (p_user_id, p_type, coalesce(p_payload, '{}'::jsonb), p_club_id, p_actor_user_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END$$;

REVOKE ALL ON FUNCTION private.emit_notification(uuid, text, jsonb, uuid, uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- RPC mark_notification_read : marque UNE notif du destinataire comme lue.
-- Idempotent. Renvoie true si une row a été affectée.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_hit     boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  UPDATE public.notifications
     SET read_at = now()
   WHERE id = p_id
     AND user_id = v_user_id
     AND read_at IS NULL;

  GET DIAGNOSTICS v_hit = ROW_COUNT;
  RETURN v_hit;
END$$;

REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC mark_all_notifications_read : marque toutes les notifs non lues du
-- destinataire comme lues. Renvoie le nombre affecté.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count   integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  UPDATE public.notifications
     SET read_at = now()
   WHERE user_id = v_user_id
     AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END$$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- ---------------------------------------------------------------------------
-- Realtime : pousser les nouvelles notifs vers l'inbox in-app (badge live).
-- Realtime respecte la RLS (chaque socket ne reçoit que ses propres rows).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
