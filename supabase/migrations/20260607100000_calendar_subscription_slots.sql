-- Abonnements ICS par SLOT
--
-- Avant : 1 abonnement ICS par équipe (PK = team_id). La fédé publie souvent un
-- lien par tour ; l'entraîneur veut donc importer jusqu'à 3 calendriers :
--   * first_round   : calendrier du 1er tour
--   * second_round  : calendrier du 2e tour
--   * full          : calendrier de la saison complète
--
-- On passe la PK à (team_id, slot) → jusqu'à 3 abonnements par équipe.

BEGIN;

ALTER TABLE public.team_calendar_subscriptions
  ADD COLUMN IF NOT EXISTS slot text NOT NULL DEFAULT 'full';

ALTER TABLE public.team_calendar_subscriptions
  DROP CONSTRAINT IF EXISTS team_calendar_subscriptions_slot_values;
ALTER TABLE public.team_calendar_subscriptions
  ADD CONSTRAINT team_calendar_subscriptions_slot_values CHECK (
    slot IN ('first_round', 'second_round', 'full')
  );

-- PK (team_id) → (team_id, slot). Les rows existantes prennent slot='full'.
ALTER TABLE public.team_calendar_subscriptions
  DROP CONSTRAINT IF EXISTS team_calendar_subscriptions_pkey;
ALTER TABLE public.team_calendar_subscriptions
  ADD CONSTRAINT team_calendar_subscriptions_pkey PRIMARY KEY (team_id, slot);

COMMIT;
