-- Modèle « calendrier vivant » — archivage des matchs joués
--
-- La fédé met à jour le MÊME lien ICS tour par tour : les matchs joués sortent du
-- flux. La synchro Grinta n'efface jamais (upsert only), mais on veut en plus
-- DÉTACHER définitivement un match du flux dès que sa date est passée :
--   * archived     : le match est sorti du calendrier actif (rangé en Historique)
--   * archived_at  : quand il a été archivé (pour tri / debug)
--
-- Un match archivé est ignoré par la synchro ICS (cf. sync.ts) → il reste pour
-- toujours, même si la fédé le retire du flux. Les vues actives filtrent
-- `archived = false`.

BEGIN;

ALTER TABLE public.team_matches
  ADD COLUMN IF NOT EXISTS archived    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Index pour lister rapidement le calendrier actif (archived = false) et
-- l'historique (archived = true), triés par date.
CREATE INDEX IF NOT EXISTS team_matches_archived_idx
  ON public.team_matches USING btree (team_id, archived, starts_at);

COMMIT;
