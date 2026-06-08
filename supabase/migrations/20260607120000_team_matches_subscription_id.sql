-- Rattache chaque match importé à l'abonnement ICS qui l'a créé
--
-- But : pouvoir supprimer les matchs venant d'un lien quand on supprime ce lien
-- (les matchs déjà joués / manuels restent — voir disconnectCalendarAction).
-- Rempli à la synchro (`syncTeamCalendar`). FK ON DELETE SET NULL : si une
-- subscription disparaît sans passer par l'action (ex. purge équipe), les matchs
-- restants sont juste détachés, pas supprimés en cascade.

BEGIN;

ALTER TABLE public.team_matches
  ADD COLUMN IF NOT EXISTS subscription_id uuid;

ALTER TABLE public.team_matches
  DROP CONSTRAINT IF EXISTS team_matches_subscription_fkey;
ALTER TABLE public.team_matches
  ADD CONSTRAINT team_matches_subscription_fkey
    FOREIGN KEY (subscription_id)
    REFERENCES public.team_calendar_subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS team_matches_subscription_idx
  ON public.team_matches USING btree (subscription_id);

COMMIT;
