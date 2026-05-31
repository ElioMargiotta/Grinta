-- Issue #61 / #75 — Import calendrier ICS des matchs officiels par équipe
--
-- Modèle :
--   * team_calendar_subscriptions : 1 row par équipe (PK = team_id),
--     stocke l'URL d'abonnement ICS (football.ch typiquement) + l'état de
--     la dernière synchro (timestamp, statut, erreur, nb événements).
--   * team_matches : les matchs officiels importés depuis l'ICS. Clé
--     d'upsert (team_id, ics_uid) — le UID football.ch reste stable
--     même si la date/lieu changent, ce qui préserve les liens futurs
--     (présences match, évaluations match...).
--
-- Sync :
--   * Server action manuelle (bouton "Synchroniser" sur la page équipe).
--   * Cron Vercel quotidien (/api/cron/calendar-sync) qui passe sur
--     toutes les subscriptions actives. Le cron utilise la service-role
--     pour bypasser RLS proprement.
--
-- RLS — calqué sur player_evaluations (club-scoped) :
--   * read  = tout membre du club (staff comme joueur affilié)
--   * write = staff full/extended/team + club actif

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. team_calendar_subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_calendar_subscriptions (
    team_id          uuid NOT NULL,
    club_id          uuid NOT NULL,
    ics_url          text NOT NULL,
    last_synced_at   timestamp with time zone,
    last_status      text,
    last_error       text,
    event_count      integer NOT NULL DEFAULT 0,
    created_by       uuid,
    created_at       timestamp with time zone NOT NULL DEFAULT now(),
    updated_at       timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT team_calendar_subscriptions_pkey PRIMARY KEY (team_id),
    CONSTRAINT team_calendar_subscriptions_team_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    CONSTRAINT team_calendar_subscriptions_club_fkey
      FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE,
    CONSTRAINT team_calendar_subscriptions_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT team_calendar_subscriptions_url_format CHECK (
      ics_url ~* '^(https?|webcal)://'
      AND length(ics_url) <= 1000
    ),
    CONSTRAINT team_calendar_subscriptions_status_values CHECK (
      last_status IS NULL OR last_status IN ('ok', 'error', 'pending')
    )
);

CREATE INDEX IF NOT EXISTS team_calendar_subscriptions_club_idx
  ON public.team_calendar_subscriptions USING btree (club_id);

-- ---------------------------------------------------------------------------
-- 2. team_matches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_matches (
    id              uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id         uuid NOT NULL,
    club_id         uuid NOT NULL,
    ics_uid         text NOT NULL,
    starts_at       timestamp with time zone NOT NULL,
    ends_at         timestamp with time zone,
    summary         text,
    location        text,
    description     text,
    match_url       text,
    source          text NOT NULL DEFAULT 'subscription',
    created_at      timestamp with time zone NOT NULL DEFAULT now(),
    updated_at      timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT team_matches_pkey PRIMARY KEY (id),
    CONSTRAINT team_matches_team_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    CONSTRAINT team_matches_club_fkey
      FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE,
    CONSTRAINT team_matches_team_uid_unique UNIQUE (team_id, ics_uid),
    CONSTRAINT team_matches_source_values CHECK (
      source IN ('subscription', 'upload')
    ),
    CONSTRAINT team_matches_summary_length CHECK (
      summary IS NULL OR length(summary) <= 500
    ),
    CONSTRAINT team_matches_location_length CHECK (
      location IS NULL OR length(location) <= 500
    ),
    CONSTRAINT team_matches_description_length CHECK (
      description IS NULL OR length(description) <= 4000
    )
);

CREATE INDEX IF NOT EXISTS team_matches_team_starts_idx
  ON public.team_matches USING btree (team_id, starts_at);
CREATE INDEX IF NOT EXISTS team_matches_club_idx
  ON public.team_matches USING btree (club_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_team_calendar_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS team_calendar_subscriptions_set_updated_at
  ON public.team_calendar_subscriptions;
CREATE TRIGGER team_calendar_subscriptions_set_updated_at
  BEFORE UPDATE ON public.team_calendar_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_team_calendar_updated_at();

DROP TRIGGER IF EXISTS team_matches_set_updated_at
  ON public.team_matches;
CREATE TRIGGER team_matches_set_updated_at
  BEFORE UPDATE ON public.team_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_team_calendar_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — team_calendar_subscriptions
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_calendar_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_calendar_subscriptions_read   ON public.team_calendar_subscriptions;
DROP POLICY IF EXISTS team_calendar_subscriptions_insert ON public.team_calendar_subscriptions;
DROP POLICY IF EXISTS team_calendar_subscriptions_update ON public.team_calendar_subscriptions;
DROP POLICY IF EXISTS team_calendar_subscriptions_delete ON public.team_calendar_subscriptions;

CREATE POLICY team_calendar_subscriptions_read
  ON public.team_calendar_subscriptions FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

CREATE POLICY team_calendar_subscriptions_insert
  ON public.team_calendar_subscriptions FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY team_calendar_subscriptions_update
  ON public.team_calendar_subscriptions FOR UPDATE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY team_calendar_subscriptions_delete
  ON public.team_calendar_subscriptions FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

-- ---------------------------------------------------------------------------
-- 5. RLS — team_matches
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_matches_read   ON public.team_matches;
DROP POLICY IF EXISTS team_matches_insert ON public.team_matches;
DROP POLICY IF EXISTS team_matches_update ON public.team_matches;
DROP POLICY IF EXISTS team_matches_delete ON public.team_matches;

CREATE POLICY team_matches_read
  ON public.team_matches FOR SELECT
  USING (private.user_club_access(club_id) IS NOT NULL);

CREATE POLICY team_matches_insert
  ON public.team_matches FOR INSERT
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY team_matches_update
  ON public.team_matches FOR UPDATE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  )
  WITH CHECK (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

CREATE POLICY team_matches_delete
  ON public.team_matches FOR DELETE
  USING (
    (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))
    AND private.club_is_active(club_id)
  );

GRANT ALL ON TABLE public.team_calendar_subscriptions TO anon;
GRANT ALL ON TABLE public.team_calendar_subscriptions TO authenticated;
GRANT ALL ON TABLE public.team_calendar_subscriptions TO service_role;

GRANT ALL ON TABLE public.team_matches TO anon;
GRANT ALL ON TABLE public.team_matches TO authenticated;
GRANT ALL ON TABLE public.team_matches TO service_role;

COMMIT;
