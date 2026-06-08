-- Refonte planning saison — entité Saison/Tour
--
-- Le générateur ne doit plus seulement produire des semaines sur une plage de
-- dates. On stocke explicitement le cadre planifié : saison sportive + segment
-- (1er tour, 2e tour, saison complète). Les microcycles générés peuvent ainsi
-- être retrouvés par tour/saison sans déduire l'appartenance uniquement par date.

BEGIN;

CREATE TABLE IF NOT EXISTS public.season_plans (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id                 uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    club_id                 uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    season_label            text NOT NULL,
    segment                 text NOT NULL,
    mode                    text NOT NULL DEFAULT 'replace',
    name                    text,
    start_date              date NOT NULL,
    championship_start_date date,
    end_date                date NOT NULL,
    status                  text NOT NULL DEFAULT 'draft',
    source                  text NOT NULL DEFAULT 'generated',
    created_at              timestamp with time zone NOT NULL DEFAULT now(),
    updated_at              timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT season_plans_segment_values CHECK (
      segment IN ('first_round', 'second_round', 'full')
    ),
    CONSTRAINT season_plans_mode_values CHECK (
      mode IN ('replace', 'merge')
    ),
    CONSTRAINT season_plans_status_values CHECK (
      status IN ('draft', 'generated', 'archived')
    ),
    CONSTRAINT season_plans_source_values CHECK (
      source IN ('manual', 'generated')
    ),
    CONSTRAINT season_plans_dates_order CHECK (end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS season_plans_team_season_segment_idx
  ON public.season_plans (team_id, season_label, segment);
CREATE INDEX IF NOT EXISTS season_plans_club_idx
  ON public.season_plans (club_id);

DROP TRIGGER IF EXISTS season_plans_set_updated_at ON public.season_plans;
CREATE TRIGGER season_plans_set_updated_at
  BEFORE UPDATE ON public.season_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_team_calendar_updated_at();

ALTER TABLE public.macrocycles
  ADD COLUMN IF NOT EXISTS season_plan_id uuid;
ALTER TABLE public.macrocycles
  DROP CONSTRAINT IF EXISTS macrocycles_season_plan_fkey;
ALTER TABLE public.macrocycles
  ADD CONSTRAINT macrocycles_season_plan_fkey
    FOREIGN KEY (season_plan_id) REFERENCES public.season_plans(id) ON DELETE SET NULL;

ALTER TABLE public.microcycles
  ADD COLUMN IF NOT EXISTS season_plan_id uuid;
ALTER TABLE public.microcycles
  DROP CONSTRAINT IF EXISTS microcycles_season_plan_fkey;
ALTER TABLE public.microcycles
  ADD CONSTRAINT microcycles_season_plan_fkey
    FOREIGN KEY (season_plan_id) REFERENCES public.season_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS macrocycles_season_plan_idx
  ON public.macrocycles (season_plan_id);

ALTER TABLE public.mesocycles
  ADD COLUMN IF NOT EXISTS season_plan_id uuid;
ALTER TABLE public.mesocycles
  DROP CONSTRAINT IF EXISTS mesocycles_season_plan_fkey;
ALTER TABLE public.mesocycles
  ADD CONSTRAINT mesocycles_season_plan_fkey
    FOREIGN KEY (season_plan_id) REFERENCES public.season_plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS mesocycles_season_plan_idx
  ON public.mesocycles (season_plan_id);
CREATE INDEX IF NOT EXISTS microcycles_season_plan_idx
  ON public.microcycles (season_plan_id, start_date);

ALTER TABLE public.season_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS season_plans_read   ON public.season_plans;
DROP POLICY IF EXISTS season_plans_insert ON public.season_plans;
DROP POLICY IF EXISTS season_plans_update ON public.season_plans;
DROP POLICY IF EXISTS season_plans_delete ON public.season_plans;

CREATE POLICY season_plans_read
  ON public.season_plans FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

CREATE POLICY season_plans_insert
  ON public.season_plans FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY season_plans_update
  ON public.season_plans FOR UPDATE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY season_plans_delete
  ON public.season_plans FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

GRANT ALL ON TABLE public.season_plans TO anon;
GRANT ALL ON TABLE public.season_plans TO authenticated;
GRANT ALL ON TABLE public.season_plans TO service_role;

COMMIT;
