-- Plusieurs calendriers ICS par tour
--
-- Avant : PK (team_id, slot) → 1 seul abonnement par tour (Tour 1 / Tour 2 /
-- Saison). En important un 2e lien classé dans le même tour, on écrasait
-- silencieusement le premier.
--
-- Maintenant : PK surrogate `id` + UNIQUE (team_id, ics_url). Une équipe peut
-- avoir plusieurs abonnements dans le même tour (ex. deux flux fédé), et un même
-- lien n'existe qu'une fois (ré-import = mise à jour, et l'auto-classement peut
-- le faire changer de tour). Le slot redevient un simple attribut.

BEGIN;

-- Clé surrogate.
ALTER TABLE public.team_calendar_subscriptions
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();

-- Dédup défensif avant l'unicité (team_id, ics_url) : on garde une row par lien.
DELETE FROM public.team_calendar_subscriptions a
  USING public.team_calendar_subscriptions b
  WHERE a.ctid < b.ctid
    AND a.team_id = b.team_id
    AND a.ics_url = b.ics_url;

ALTER TABLE public.team_calendar_subscriptions
  DROP CONSTRAINT IF EXISTS team_calendar_subscriptions_pkey;
ALTER TABLE public.team_calendar_subscriptions
  ADD CONSTRAINT team_calendar_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE public.team_calendar_subscriptions
  DROP CONSTRAINT IF EXISTS team_calendar_subscriptions_team_url_uniq;
ALTER TABLE public.team_calendar_subscriptions
  ADD CONSTRAINT team_calendar_subscriptions_team_url_uniq UNIQUE (team_id, ics_url);

-- Lookups par tour (liste UI, garde-fou conflit).
CREATE INDEX IF NOT EXISTS team_calendar_subscriptions_team_slot_idx
  ON public.team_calendar_subscriptions USING btree (team_id, slot);

COMMIT;
