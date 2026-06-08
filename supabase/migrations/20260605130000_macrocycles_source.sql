-- Lot 4 / unification saison ↔ hebdo — Migration D
--
-- Le générateur de saison écrit désormais dans macro/méso/micro (le modèle que
-- la vue Hebdo sait déjà lire). On marque le macrocycle qu'il produit avec
-- source = 'generated' pour pouvoir le régénérer proprement (delete + recreate)
-- sans toucher à un éventuel macrocycle saisi à la main ('manual').

BEGIN;

ALTER TABLE public.macrocycles
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.macrocycles
  DROP CONSTRAINT IF EXISTS macrocycles_source_values;
ALTER TABLE public.macrocycles
  ADD CONSTRAINT macrocycles_source_values CHECK (
    source IN ('manual', 'generated')
  );

-- Au plus un macrocycle généré par équipe (le générateur le remplace à chaque
-- régénération).
CREATE UNIQUE INDEX IF NOT EXISTS macrocycles_one_generated_per_team
  ON public.macrocycles (team_id)
  WHERE source = 'generated';

COMMIT;
