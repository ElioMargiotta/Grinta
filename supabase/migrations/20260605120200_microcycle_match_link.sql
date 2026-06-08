-- Lot 1 / refonte planning piloté par les matchs — Migration C
--
-- Les microcycles s'accrochent désormais aux matchs (couche 2 du modèle) :
--   * team_id        : dénormalisé → un microcycle appartient à une équipe, plus
--                      forcément à une phase (mesocycle). Backfillé depuis la
--                      chaîne mesocycle → macrocycle existante.
--   * target_match_id: le match préparé par cette semaine d'entraînement.
--   * kind           : nature du microcycle (preparation/competition/recovery…).
--   * mesocycle_id   : devient NULLABLE — les phases (méso/macro) deviennent de
--                      simples bandeaux optionnels posés par-dessus.
--
-- La RLS microcycles passait par EXISTS(mesocycle→macrocycle) : ça casse pour les
-- rows à mesocycle_id NULL. On la réécrit sur team_id (pattern macrocycles).
--
-- sessions :
--   * md_offset : position MD- (négatif = jours avant le match, 0 = jour du match).
--   * source    : 'manual' (saisie) vs 'generated' (posée par le générateur). Le
--                 re-générateur ne purge/recrée que les sessions 'generated'.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. microcycles : nouvelles colonnes
-- ---------------------------------------------------------------------------
ALTER TABLE public.microcycles
  ADD COLUMN IF NOT EXISTS team_id         uuid,
  ADD COLUMN IF NOT EXISTS target_match_id uuid,
  ADD COLUMN IF NOT EXISTS kind            text DEFAULT 'competition';

-- Backfill team_id depuis la hiérarchie existante.
UPDATE public.microcycles mc
SET team_id = ma.team_id
FROM public.mesocycles me
JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
WHERE me.id = mc.mesocycle_id
  AND mc.team_id IS NULL;

ALTER TABLE public.microcycles
  ALTER COLUMN team_id SET NOT NULL;

-- mesocycle_id devient optionnel.
ALTER TABLE public.microcycles
  ALTER COLUMN mesocycle_id DROP NOT NULL;

ALTER TABLE public.microcycles
  DROP CONSTRAINT IF EXISTS microcycles_team_fkey;
ALTER TABLE public.microcycles
  ADD CONSTRAINT microcycles_team_fkey
    FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.microcycles
  DROP CONSTRAINT IF EXISTS microcycles_target_match_fkey;
ALTER TABLE public.microcycles
  ADD CONSTRAINT microcycles_target_match_fkey
    FOREIGN KEY (target_match_id) REFERENCES public.team_matches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS microcycles_team_start_idx
  ON public.microcycles USING btree (team_id, start_date);
CREATE INDEX IF NOT EXISTS microcycles_target_match_idx
  ON public.microcycles USING btree (target_match_id);

-- ---------------------------------------------------------------------------
-- 2. microcycles : RLS réécrite sur team_id (pattern macrocycles)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS microcycles_read   ON public.microcycles;
DROP POLICY IF EXISTS microcycles_insert ON public.microcycles;
DROP POLICY IF EXISTS microcycles_update ON public.microcycles;
DROP POLICY IF EXISTS microcycles_delete ON public.microcycles;

CREATE POLICY microcycles_read ON public.microcycles FOR SELECT
  USING (private.user_team_access(team_id) IS NOT NULL);

CREATE POLICY microcycles_insert ON public.microcycles FOR INSERT
  WITH CHECK (
    private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])
  );

CREATE POLICY microcycles_update ON public.microcycles FOR UPDATE
  USING (
    private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])
  )
  WITH CHECK (
    private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])
  );

CREATE POLICY microcycles_delete ON public.microcycles FOR DELETE
  USING (
    private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])
  );

-- ---------------------------------------------------------------------------
-- 3. sessions : md_offset + source
-- ---------------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS md_offset smallint,
  ADD COLUMN IF NOT EXISTS source    text NOT NULL DEFAULT 'manual';

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_source_values;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_source_values CHECK (
    source IN ('manual', 'generated')
  );

CREATE INDEX IF NOT EXISTS sessions_microcycle_idx
  ON public.sessions USING btree (microcycle_id);

COMMIT;
