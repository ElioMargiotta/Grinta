-- Lot 1 (suite) — Retrait d'une notification par son destinataire.
--
-- Le marquage "lu" (mark_notification_read) ne supprime pas la row : l'inbox
-- garde l'historique. Ce complément permet au destinataire de RETIRER une notif
-- de sa boîte (suppression définitive de SA row). Comme l'émission, l'opération
-- passe par une RPC SECURITY DEFINER : aucun DELETE direct n'est ouvert côté
-- client (la table reste en default-deny pour l'écriture).

BEGIN;

-- ---------------------------------------------------------------------------
-- RPC dismiss_notification : retire UNE notif du destinataire (DELETE scopé).
-- Idempotent. Renvoie true si une row a été supprimée.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dismiss_notification(p_id uuid)
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

  DELETE FROM public.notifications
   WHERE id = p_id
     AND user_id = v_user_id;

  GET DIAGNOSTICS v_hit = ROW_COUNT;
  RETURN v_hit;
END$$;

REVOKE ALL ON FUNCTION public.dismiss_notification(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_notification(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
