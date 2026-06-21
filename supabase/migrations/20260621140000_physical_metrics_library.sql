-- Bibliothèque d'indicateurs : métadonnées enrichies + lien vers la lib par défaut
--
-- Étend `physical_metrics` (cf. 20260618130000 / 20260621120000) pour porter une
-- bibliothèque par défaut structurée (physique / technique / médical) avec
-- description, protocole et métadonnées d'interprétation dans le temps.
--
--   * subcategory           : sous-catégorie (ex. endurance_aerobie)
--   * value_type            : integer | decimal | percentage | score | number
--   * interpretation        : higher | lower | target (sens d'interprétation)
--   * material              : matériel nécessaire (liste)
--   * trials                : nombre/teneur des essais (ex. "3, meilleur retenu")
--   * validity_conditions   : conditions de validité de la mesure
--   * recommended_frequency : fréquence recommandée (ex. "6-8 semaines")
--   * display               : primary | secondary (mise en avant)
--   * alert_threshold       : seuil d'alerte (indicateurs médicaux surtout)
--   * default_key           : clé d'origine si issu de la bibliothèque par défaut
--
-- `interpretation` reste cohérent avec `higher_is_better` (rétro-compat des
-- courbes/tendances) : higher→true, lower→false, target→true par défaut.
-- Forward-only et idempotent.

BEGIN;

ALTER TABLE public.physical_metrics ADD COLUMN IF NOT EXISTS subcategory           text;
ALTER TABLE public.physical_metrics ADD COLUMN IF NOT EXISTS value_type            text;
ALTER TABLE public.physical_metrics ADD COLUMN IF NOT EXISTS interpretation        text NOT NULL DEFAULT 'higher';
ALTER TABLE public.physical_metrics ADD COLUMN IF NOT EXISTS material              text[];
ALTER TABLE public.physical_metrics ADD COLUMN IF NOT EXISTS trials                text;
ALTER TABLE public.physical_metrics ADD COLUMN IF NOT EXISTS validity_conditions   text;
ALTER TABLE public.physical_metrics ADD COLUMN IF NOT EXISTS recommended_frequency text;
ALTER TABLE public.physical_metrics ADD COLUMN IF NOT EXISTS display               text NOT NULL DEFAULT 'primary';
ALTER TABLE public.physical_metrics ADD COLUMN IF NOT EXISTS alert_threshold       numeric;
ALTER TABLE public.physical_metrics ADD COLUMN IF NOT EXISTS default_key           text;

ALTER TABLE public.physical_metrics
  DROP CONSTRAINT IF EXISTS physical_metrics_interpretation_check;
ALTER TABLE public.physical_metrics
  ADD CONSTRAINT physical_metrics_interpretation_check
  CHECK (interpretation IN ('higher', 'lower', 'target'));

ALTER TABLE public.physical_metrics
  DROP CONSTRAINT IF EXISTS physical_metrics_display_check;
ALTER TABLE public.physical_metrics
  ADD CONSTRAINT physical_metrics_display_check
  CHECK (display IN ('primary', 'secondary'));

-- Un indicateur par défaut ne peut être activé qu'une fois par club.
DROP INDEX IF EXISTS public.physical_metrics_club_default_key;
CREATE UNIQUE INDEX physical_metrics_club_default_key
  ON public.physical_metrics (club_id, default_key)
  WHERE default_key IS NOT NULL;

COMMIT;
