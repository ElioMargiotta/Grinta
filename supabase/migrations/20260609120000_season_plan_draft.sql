-- Planification saison — brouillon de structure
--
-- On veut pouvoir ENREGISTRER les dates + la structure d'un tour (préparation,
-- cycles/mésocycles, créneaux d'entraînement) SANS générer le squelette. Le
-- cadre saison/tour vit déjà dans `season_plans` (start_date / end_date /
-- segment / status='draft'), mais il n'y avait nulle part où conserver la
-- structure saisie. On ajoute une colonne `draft` JSON :
--   { structure: { prepWeeks, prepTheme, mesos[] }, trainingSlots[] }
--
-- Rechargée à la réouverture du wizard et réutilisée à la génération.

BEGIN;

ALTER TABLE public.season_plans
  ADD COLUMN IF NOT EXISTS draft jsonb;

COMMIT;
