-- Retire les anciens indicateurs médicaux auto-déclarés de la bibliothèque par
-- défaut (douleur, disponibilité, fatigue, sommeil, RPE, charge interne).
--
-- Ce ne sont pas des tests d'évaluation : ils polluaient la liste des tests.
--   * la disponibilité médicale est désormais gérée par player_unavailability ;
--   * fatigue/sommeil/RPE/charge relèveront d'un module wellness dédié.
--
-- On supprime les lignes activées dans les clubs (identifiées par default_key).
-- La FK physical_measurements.metric_id étant ON DELETE CASCADE, les éventuelles
-- mesures liées sont retirées avec l'indicateur. Forward-only et idempotent.

BEGIN;

DELETE FROM public.physical_metrics
 WHERE default_key IN (
   'douleur',
   'disponibilite',
   'fatigue',
   'sommeil',
   'rpe',
   'charge_interne'
 );

COMMIT;
