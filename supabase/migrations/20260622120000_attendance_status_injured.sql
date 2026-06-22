-- Ajoute 'injured' au statut de présence.
--
-- Permet un statut « blessé » modifiable PAR SÉANCE depuis la grille d'éval
-- (override ponctuel qui prime sur les périodes médicales `player_unavailability`
-- sans les modifier). Les périodes restent la source de vérité long terme ;
-- `session_attendances.actual_status` porte l'exception du jour.
--
-- NB : ALTER TYPE ... ADD VALUE ne peut pas tourner dans un bloc transactionnel,
-- donc pas de BEGIN/COMMIT ici. Idempotent via IF NOT EXISTS.

ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'injured';
