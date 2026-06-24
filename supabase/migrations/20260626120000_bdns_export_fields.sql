-- Issue #59 — Export BDNS (Contrôle des présences J+S / OFSPO)
--
-- Champs nécessaires au CSV d'import BDNS :
--   * club_memberships.js_number : N° de personne J+S du moniteur/staff
--     (équivalent de players.js_number pour les participants, cf. #38).
--   * sessions.location : lieu de l'entraînement (colonne LIEU du CSV).
--     Défini par défaut au créneau hebdomadaire (wizard de planification),
--     modifiable séance par séance. Les matchs portent déjà `location`.
--
-- 100 % additif, tous nullable.

BEGIN;

ALTER TABLE public.club_memberships
  ADD COLUMN IF NOT EXISTS js_number text;

COMMENT ON COLUMN public.club_memberships.js_number IS
  'Numéro Jeunesse+Sport du moniteur/staff (export BDNS #59).';

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS location text;

COMMENT ON COLUMN public.sessions.location IS
  'Lieu de la séance (colonne LIEU export BDNS #59). Hérité du créneau hebdo, modifiable par séance.';

COMMIT;
