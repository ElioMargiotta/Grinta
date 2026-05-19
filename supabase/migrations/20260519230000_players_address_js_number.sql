-- Issue #38 — Champs additionnels joueur pour import ClubCorner (EPIC #34)
--
-- Le N° J+S est l'identifiant Jeunesse+Sport requis pour TIPS ASF (#53)
-- et l'export BDNS (#59). L'adresse postale alimente également BDNS.
-- 100 % ADDITIF, tous nullable.

BEGIN;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS js_number    text,
  ADD COLUMN IF NOT EXISTS address      text,
  ADD COLUMN IF NOT EXISTS postal_code  text,
  ADD COLUMN IF NOT EXISTS city         text,
  ADD COLUMN IF NOT EXISTS canton       text;

COMMENT ON COLUMN public.players.js_number IS
  'Numéro Jeunesse+Sport (#38, alimente TIPS ASF #53 et BDNS #59).';
COMMENT ON COLUMN public.players.address IS
  'Adresse postale (rue), import ClubCorner (#38).';

COMMIT;
