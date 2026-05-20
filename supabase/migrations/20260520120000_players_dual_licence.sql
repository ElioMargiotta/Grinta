-- EPIC #34 — Double licence ASF (joueur licencié dans deux clubs).
--
-- Différencie deux cas conceptuellement distincts :
--   (a) multi-équipes intra-club  → player_team_assignments (#39)
--   (b) double passeport inter-club → annotation locale sur le row players
--       du club courant. Pas de FK cross-tenant : chaque club annote son
--       propre row indépendamment, RLS reste club-scoped (#36).
--
-- Le license_number ASF reste l'identifiant pivot pour un futur export
-- BDNS (#59) — la corrélation cross-club se fait à l'export, pas à l'app.
--
-- 100 % ADDITIF, tous nullable.

BEGIN;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS dual_licence_club  text,
  ADD COLUMN IF NOT EXISTS dual_licence_level text
    CHECK (
      dual_licence_level IS NULL
      OR dual_licence_level IN ('elite', 'amateur', 'other')
    ),
  ADD COLUMN IF NOT EXISTS dual_licence_team  text;

COMMENT ON COLUMN public.players.dual_licence_club IS
  'Nom du club secondaire si double licence ASF. Annotation locale au club, pas de FK (EPIC #34).';
COMMENT ON COLUMN public.players.dual_licence_level IS
  'Niveau du club secondaire : elite | amateur | other.';
COMMENT ON COLUMN public.players.dual_licence_team IS
  'Nom de l''équipe dans le club secondaire si connu.';

COMMIT;
