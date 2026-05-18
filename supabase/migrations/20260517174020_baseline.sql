--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: access_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.access_level AS ENUM (
    'full',
    'extended',
    'team',
    'team_readonly'
);


--
-- Name: club_is_active(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.club_is_active(p_club_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select subscription_status in ('active','trialing')
  from public.clubs where id = p_club_id
$$;


--
-- Name: user_club_access(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.user_club_access(p_club_id uuid) RETURNS public.access_level
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.access_level
  from public.club_memberships m
  join public.club_roles r on r.id = m.role_id
  where m.user_id = auth.uid()
    and m.club_id = p_club_id
  limit 1
$$;


--
-- Name: user_team_access(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.user_team_access(p_team_id uuid) RETURNS public.access_level
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_club_id uuid;
  v_lvl access_level;
begin
  select club_id into v_club_id from public.teams where id = p_team_id;
  if v_club_id is null then return null; end if;

  v_lvl := private.user_club_access(v_club_id);
  if v_lvl is null then return null; end if;

  if v_lvl in ('full','extended') then
    return v_lvl;
  end if;

  if exists (
    select 1 from public.team_memberships tm
    join public.club_memberships m on m.id = tm.membership_id
    where tm.team_id = p_team_id and m.user_id = auth.uid()
  ) then
    return v_lvl;
  end if;

  return null;
end $$;


--
-- Name: accept_invitation(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_invitation(p_token text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_email text;
  v_inv  record;
  v_membership_id uuid;
  v_team uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  select email into v_user_email from auth.users where id = auth.uid();

  select * into v_inv from club_invitations where token = p_token for update;
  if v_inv is null then
    raise exception 'invitation not found';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'invitation already accepted';
  end if;

  if v_inv.expires_at < now() then
    raise exception 'invitation expired';
  end if;

  if lower(v_inv.email) <> lower(v_user_email) then
    raise exception 'this invitation was sent to %, not your account', v_inv.email;
  end if;

  insert into club_memberships (club_id, user_id, role_id)
  values (v_inv.club_id, auth.uid(), v_inv.role_id)
  on conflict (club_id, user_id) do update set role_id = excluded.role_id
  returning id into v_membership_id;

  if v_inv.team_ids is not null and array_length(v_inv.team_ids, 1) > 0 then
    foreach v_team in array v_inv.team_ids loop
      insert into team_memberships (team_id, membership_id)
      values (v_team, v_membership_id)
      on conflict do nothing;
    end loop;
  end if;

  update club_invitations set accepted_at = now() where id = v_inv.id;

  return v_inv.club_id;
end $$;


--
-- Name: accept_my_invitation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_my_invitation(p_invitation_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_token text;
begin
  select token into v_token
  from club_invitations
  where id = p_invitation_id;

  if v_token is null then
    raise exception 'invitation not found';
  end if;

  return accept_invitation(v_token);
end $$;


--
-- Name: archive_team(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_team(p_team_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_lvl  access_level;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  v_lvl := private.user_team_access(p_team_id);
  if v_lvl is null or v_lvl <> 'full' then
    raise exception 'only full-access members can archive a team';
  end if;

  update public.teams
     set archived_at = now()
   where id = p_team_id
     and archived_at is null;
end $$;


--
-- Name: create_club(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_club(p_name text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_club_id       uuid;
  v_owner_role_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  insert into clubs (name, subscription_status, trial_ends_at)
  values (coalesce(nullif(trim(p_name), ''), 'Mon club'),
          'trialing',
          now() + interval '14 days')
  returning id into v_club_id;

  insert into club_roles (club_id, name, access_level, is_system)
  values (v_club_id, 'Propriétaire', 'full', true)
  returning id into v_owner_role_id;

  insert into club_roles (club_id, name, access_level, is_system)
  values (v_club_id, 'Coach', 'team', true);

  insert into club_memberships (club_id, user_id, role_id)
  values (v_club_id, auth.uid(), v_owner_role_id);

  -- Default team so the club is immediately usable. User can rename/extend
  -- via /teams/<id>. trainer_id is set to the owner per existing convention.
  insert into teams (club_id, trainer_id, name)
  values (v_club_id, auth.uid(), 'Actif');

  return v_club_id;
end $$;


--
-- Name: create_invitation(uuid, text, uuid, uuid[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_invitation(p_club_id uuid, p_email text, p_role_id uuid, p_team_ids uuid[] DEFAULT '{}'::uuid[], p_ttl_hours integer DEFAULT 168) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_token text;
  v_role record;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  if private.user_club_access(p_club_id) <> 'full' then
    raise exception 'forbidden: only full-access members can invite';
  end if;

  select id, access_level into v_role
  from club_roles where id = p_role_id and club_id = p_club_id;

  if v_role is null then
    raise exception 'role does not belong to this club';
  end if;

  if v_role.access_level in ('team','team_readonly') and (p_team_ids is null or array_length(p_team_ids,1) is null) then
    raise exception 'team-scoped role requires at least one team';
  end if;

  if v_role.access_level in ('full','extended') and p_team_ids is not null and array_length(p_team_ids,1) is not null then
    raise exception 'club-wide role must not specify teams';
  end if;

  v_token := replace(replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+','-'), '/','_'), '=','');

  delete from club_invitations
   where club_id = p_club_id and lower(email) = lower(p_email) and accepted_at is null;

  insert into club_invitations (club_id, email, role_id, team_ids, invited_by, token, expires_at)
  values (p_club_id, lower(p_email), p_role_id, coalesce(p_team_ids, '{}'::uuid[]),
          auth.uid(), v_token, now() + (p_ttl_hours || ' hours')::interval);

  return v_token;
end $$;


--
-- Name: create_team(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_team(p_club_id uuid, p_name text, p_season text DEFAULT NULL::text, p_age_group text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_lvl  access_level;
  v_team uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_club_id is null then
    raise exception 'club_id is required';
  end if;

  v_lvl := private.user_club_access(p_club_id);
  if v_lvl is null or v_lvl <> 'full' then
    raise exception 'no full access to this club';
  end if;

  if not private.club_is_active(p_club_id) then
    raise exception 'club not active';
  end if;

  insert into public.teams (club_id, trainer_id, name, season, age_group)
  values (
    p_club_id,
    v_user,
    p_name,
    nullif(p_season, ''),
    nullif(p_age_group, '')
  )
  returning id into v_team;

  return v_team;
end $$;


--
-- Name: delete_team_permanently(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_team_permanently(p_team_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_lvl  access_level;
  v_archived timestamptz;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  v_lvl := private.user_team_access(p_team_id);
  if v_lvl is null or v_lvl <> 'full' then
    raise exception 'only full-access members can delete a team';
  end if;

  select archived_at into v_archived from teams where id = p_team_id;
  if v_archived is null then
    raise exception 'team must be archived first';
  end if;

  delete from public.teams where id = p_team_id;
end $$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;


--
-- Name: my_pending_invitations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_pending_invitations() RETURNS TABLE(invitation_id uuid, token text, club_id uuid, club_name text, role_id uuid, role_name text, access_level public.access_level, expires_at timestamp with time zone, invited_by_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    i.id,
    i.token,
    c.id,
    c.name,
    r.id,
    r.name,
    r.access_level,
    i.expires_at,
    p.full_name
  from auth.users u
  join club_invitations i on lower(i.email) = lower(u.email)
  join clubs c       on c.id = i.club_id
  join club_roles r  on r.id = i.role_id
  left join profiles p on p.id = i.invited_by
  where u.id = auth.uid()
    and i.accepted_at is null
    and i.expires_at > now()
  order by i.created_at desc;
$$;


--
-- Name: preview_invitation(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preview_invitation(p_token text) RETURNS TABLE(club_id uuid, club_name text, role_name text, access_level public.access_level, email text, expires_at timestamp with time zone, already_accepted boolean, expired boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    c.id,
    c.name,
    r.name,
    r.access_level,
    i.email,
    i.expires_at,
    i.accepted_at is not null,
    i.expires_at < now()
  from club_invitations i
  join clubs c      on c.id = i.club_id
  join club_roles r on r.id = i.role_id
  where i.token = p_token
  limit 1
$$;


--
-- Name: restore_team(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_team(p_team_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_lvl  access_level;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  v_lvl := private.user_team_access(p_team_id);
  if v_lvl is null or v_lvl <> 'full' then
    raise exception 'only full-access members can restore a team';
  end if;

  update public.teams
     set archived_at = null
   where id = p_team_id
     and archived_at is not null;
end $$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


--
-- Name: teams_sync_billable_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.teams_sync_billable_count() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_club_id uuid;
begin
  v_club_id := coalesce(new.club_id, old.club_id);
  update public.clubs
     set billable_team_count = (
       select count(*) from public.teams
       where club_id = v_club_id and archived_at is null
     )
   where id = v_club_id;
  return null;
end $$;


--
-- Name: update_team(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_team(p_team_id uuid, p_name text, p_season text DEFAULT NULL::text, p_age_group text DEFAULT NULL::text, p_description text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_lvl  access_level;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  v_lvl := private.user_team_access(p_team_id);
  if v_lvl is null or v_lvl not in ('full','extended') then
    raise exception 'forbidden';
  end if;

  update public.teams
     set name        = coalesce(nullif(trim(p_name), ''), name),
         season      = nullif(trim(coalesce(p_season,'')), ''),
         age_group   = nullif(trim(coalesce(p_age_group,'')), ''),
         description = nullif(trim(coalesce(p_description,'')), '')
   where id = p_team_id;
end $$;


--
-- Name: update_team(uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_team(p_team_id uuid, p_name text, p_season text DEFAULT NULL::text, p_age_group text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_photo_url text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_club uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select t.club_id into v_club
  from public.teams t
  where t.id = p_team_id;

  if v_club is null then
    raise exception 'team not found';
  end if;

  if private.user_team_access(p_team_id) not in ('full', 'extended', 'team') then
    raise exception 'not allowed';
  end if;

  if not private.club_is_active(v_club) then
    raise exception 'club not active';
  end if;

  update public.teams
     set name = nullif(trim(p_name), ''),
         season = nullif(trim(coalesce(p_season, '')), ''),
         age_group = nullif(trim(coalesce(p_age_group, '')), ''),
         description = nullif(trim(coalesce(p_description, '')), ''),
         photo_url = nullif(trim(coalesce(p_photo_url, '')), '')
   where id = p_team_id;
end $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: billing_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid,
    stripe_event_id text,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: club_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    email text NOT NULL,
    role_id uuid NOT NULL,
    team_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    invited_by uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: club_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: club_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.club_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    name text NOT NULL,
    access_level public.access_level NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clubs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'trialing'::text NOT NULL,
    trial_ends_at timestamp with time zone,
    current_period_end timestamp with time zone,
    billable_team_count integer DEFAULT 0 NOT NULL,
    logo_url text,
    theme_mode text DEFAULT 'day'::text NOT NULL,
    theme_primary_color text DEFAULT '#18181b'::text NOT NULL,
    theme_secondary_color text DEFAULT '#f4f4f5'::text NOT NULL,
    theme_night_primary_color text DEFAULT '#f4f4f5'::text NOT NULL,
    theme_night_secondary_color text DEFAULT '#18181b'::text NOT NULL,
    CONSTRAINT clubs_logo_url_length CHECK (((logo_url IS NULL) OR (length(logo_url) <= 500))),
    CONSTRAINT clubs_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'incomplete'::text, 'paused'::text]))),
    CONSTRAINT clubs_theme_mode_check CHECK ((theme_mode = ANY (ARRAY['day'::text, 'night'::text]))),
    CONSTRAINT clubs_theme_night_primary_color_hex CHECK ((theme_night_primary_color ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT clubs_theme_night_secondary_color_hex CHECK ((theme_night_secondary_color ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT clubs_theme_primary_color_hex CHECK ((theme_primary_color ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT clubs_theme_secondary_color_hex CHECK ((theme_secondary_color ~ '^#[0-9A-Fa-f]{6}$'::text))
);


--
-- Name: exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trainer_id uuid,
    name text NOT NULL,
    description text,
    category text,
    duration_minutes integer,
    intensity text,
    equipment text[],
    created_at timestamp with time zone DEFAULT now(),
    code text,
    titre text,
    theme text,
    track text,
    level integer,
    niveau text,
    duree text,
    organisation text,
    forme_physique text[] DEFAULT ARRAY[]::text[] NOT NULL,
    tactique text[] DEFAULT ARRAY[]::text[] NOT NULL,
    mentalite text[] DEFAULT ARRAY[]::text[] NOT NULL,
    technique text[] DEFAULT ARRAY[]::text[] NOT NULL,
    main_image text,
    variation_less_text text,
    variation_more_text text,
    source text,
    club_id uuid
);


--
-- Name: macrocycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.macrocycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    trainer_id uuid NOT NULL,
    name text NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    preseason_start_date date NOT NULL,
    first_match_date date NOT NULL,
    end_date date NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT macrocycles_dates_check CHECK (((preseason_start_date <= first_match_date) AND (first_match_date <= end_date)))
);


--
-- Name: mesocycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mesocycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    macrocycle_id uuid NOT NULL,
    trainer_id uuid NOT NULL,
    name text NOT NULL,
    kind text DEFAULT 'custom'::text NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT mesocycles_kind_check CHECK ((kind = ANY (ARRAY['preparation'::text, 'competition'::text, 'transition'::text, 'custom'::text])))
);


--
-- Name: microcycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.microcycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mesocycle_id uuid NOT NULL,
    trainer_id uuid NOT NULL,
    start_date date NOT NULL,
    week_number integer NOT NULL,
    theme text,
    format text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    trainer_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    birth_date date,
    "position" text,
    jersey_number integer,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: session_exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_exercises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    exercise_id uuid NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    duration_override_minutes integer,
    notes text
);


--
-- Name: session_preparations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_preparations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    trainer_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid,
    trainer_id uuid NOT NULL,
    date date NOT NULL,
    start_time time without time zone,
    duration_minutes integer,
    theme text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    microcycle_id uuid
);


--
-- Name: team_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    membership_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trainer_id uuid NOT NULL,
    name text NOT NULL,
    season text,
    age_group text,
    created_at timestamp with time zone DEFAULT now(),
    club_id uuid NOT NULL,
    archived_at timestamp with time zone,
    description text,
    photo_url text,
    CONSTRAINT teams_photo_url_length CHECK (((photo_url IS NULL) OR (length(photo_url) <= 500)))
);


--
-- Name: billing_events billing_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_events
    ADD CONSTRAINT billing_events_pkey PRIMARY KEY (id);


--
-- Name: billing_events billing_events_stripe_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_events
    ADD CONSTRAINT billing_events_stripe_event_id_key UNIQUE (stripe_event_id);


--
-- Name: club_invitations club_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_invitations
    ADD CONSTRAINT club_invitations_pkey PRIMARY KEY (id);


--
-- Name: club_invitations club_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_invitations
    ADD CONSTRAINT club_invitations_token_key UNIQUE (token);


--
-- Name: club_memberships club_memberships_club_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_memberships
    ADD CONSTRAINT club_memberships_club_id_user_id_key UNIQUE (club_id, user_id);


--
-- Name: club_memberships club_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_memberships
    ADD CONSTRAINT club_memberships_pkey PRIMARY KEY (id);


--
-- Name: club_roles club_roles_club_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_roles
    ADD CONSTRAINT club_roles_club_id_name_key UNIQUE (club_id, name);


--
-- Name: club_roles club_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_roles
    ADD CONSTRAINT club_roles_pkey PRIMARY KEY (id);


--
-- Name: clubs clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);


--
-- Name: clubs clubs_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_slug_key UNIQUE (slug);


--
-- Name: clubs clubs_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: clubs clubs_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: macrocycles macrocycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.macrocycles
    ADD CONSTRAINT macrocycles_pkey PRIMARY KEY (id);


--
-- Name: mesocycles mesocycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesocycles
    ADD CONSTRAINT mesocycles_pkey PRIMARY KEY (id);


--
-- Name: microcycles microcycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.microcycles
    ADD CONSTRAINT microcycles_pkey PRIMARY KEY (id);


--
-- Name: microcycles microcycles_unique_start; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.microcycles
    ADD CONSTRAINT microcycles_unique_start UNIQUE (mesocycle_id, start_date);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: session_exercises session_exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_exercises
    ADD CONSTRAINT session_exercises_pkey PRIMARY KEY (id);


--
-- Name: session_preparations session_preparations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_preparations
    ADD CONSTRAINT session_preparations_pkey PRIMARY KEY (id);


--
-- Name: session_preparations session_preparations_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_preparations
    ADD CONSTRAINT session_preparations_session_id_key UNIQUE (session_id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: team_memberships team_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_memberships
    ADD CONSTRAINT team_memberships_pkey PRIMARY KEY (id);


--
-- Name: team_memberships team_memberships_team_id_membership_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_memberships
    ADD CONSTRAINT team_memberships_team_id_membership_id_key UNIQUE (team_id, membership_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: billing_events_club_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX billing_events_club_idx ON public.billing_events USING btree (club_id, processed_at DESC);


--
-- Name: club_invitations_invited_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_invitations_invited_by_idx ON public.club_invitations USING btree (invited_by);


--
-- Name: club_invitations_pending_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX club_invitations_pending_uniq ON public.club_invitations USING btree (club_id, email) WHERE (accepted_at IS NULL);


--
-- Name: club_invitations_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_invitations_role_idx ON public.club_invitations USING btree (role_id);


--
-- Name: club_memberships_club_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_memberships_club_idx ON public.club_memberships USING btree (club_id);


--
-- Name: club_memberships_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_memberships_role_idx ON public.club_memberships USING btree (role_id);


--
-- Name: club_memberships_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_memberships_user_idx ON public.club_memberships USING btree (user_id);


--
-- Name: club_roles_club_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX club_roles_club_idx ON public.club_roles USING btree (club_id);


--
-- Name: clubs_subscription_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clubs_subscription_status_idx ON public.clubs USING btree (subscription_status);


--
-- Name: exercises_club_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exercises_club_idx ON public.exercises USING btree (club_id);


--
-- Name: exercises_code_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX exercises_code_uniq ON public.exercises USING btree (code) WHERE (code IS NOT NULL);


--
-- Name: exercises_forme_physique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exercises_forme_physique_idx ON public.exercises USING gin (forme_physique);


--
-- Name: exercises_level_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exercises_level_idx ON public.exercises USING btree (level);


--
-- Name: exercises_mentalite_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exercises_mentalite_idx ON public.exercises USING gin (mentalite);


--
-- Name: exercises_solo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exercises_solo_idx ON public.exercises USING btree (trainer_id) WHERE ((club_id IS NULL) AND (trainer_id IS NOT NULL));


--
-- Name: exercises_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exercises_source_idx ON public.exercises USING btree (source);


--
-- Name: exercises_tactique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exercises_tactique_idx ON public.exercises USING gin (tactique);


--
-- Name: exercises_technique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exercises_technique_idx ON public.exercises USING gin (technique);


--
-- Name: exercises_theme_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exercises_theme_idx ON public.exercises USING btree (theme);


--
-- Name: exercises_track_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exercises_track_idx ON public.exercises USING btree (track);


--
-- Name: exercises_trainer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exercises_trainer_idx ON public.exercises USING btree (trainer_id);


--
-- Name: macrocycles_team_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX macrocycles_team_idx ON public.macrocycles USING btree (team_id, order_index);


--
-- Name: macrocycles_trainer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX macrocycles_trainer_idx ON public.macrocycles USING btree (trainer_id);


--
-- Name: mesocycles_macrocycle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mesocycles_macrocycle_idx ON public.mesocycles USING btree (macrocycle_id, order_index);


--
-- Name: mesocycles_trainer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mesocycles_trainer_idx ON public.mesocycles USING btree (trainer_id);


--
-- Name: microcycles_mesocycle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX microcycles_mesocycle_idx ON public.microcycles USING btree (mesocycle_id, start_date);


--
-- Name: microcycles_trainer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX microcycles_trainer_idx ON public.microcycles USING btree (trainer_id);


--
-- Name: players_team_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX players_team_idx ON public.players USING btree (team_id);


--
-- Name: players_trainer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX players_trainer_idx ON public.players USING btree (trainer_id);


--
-- Name: session_exercises_exercise_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX session_exercises_exercise_idx ON public.session_exercises USING btree (exercise_id);


--
-- Name: session_exercises_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX session_exercises_session_idx ON public.session_exercises USING btree (session_id);


--
-- Name: session_preparations_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX session_preparations_session_idx ON public.session_preparations USING btree (session_id);


--
-- Name: session_preparations_trainer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX session_preparations_trainer_idx ON public.session_preparations USING btree (trainer_id);


--
-- Name: sessions_microcycle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_microcycle_idx ON public.sessions USING btree (microcycle_id);


--
-- Name: sessions_solo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_solo_idx ON public.sessions USING btree (trainer_id) WHERE (team_id IS NULL);


--
-- Name: sessions_team_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_team_date_idx ON public.sessions USING btree (team_id, date);


--
-- Name: sessions_trainer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_trainer_idx ON public.sessions USING btree (trainer_id);


--
-- Name: team_memberships_membership_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_memberships_membership_idx ON public.team_memberships USING btree (membership_id);


--
-- Name: team_memberships_team_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_memberships_team_idx ON public.team_memberships USING btree (team_id);


--
-- Name: teams_club_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teams_club_idx ON public.teams USING btree (club_id);


--
-- Name: teams_trainer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teams_trainer_idx ON public.teams USING btree (trainer_id);


--
-- Name: clubs clubs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clubs_set_updated_at BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: teams teams_sync_count_del; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER teams_sync_count_del AFTER DELETE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.teams_sync_billable_count();


--
-- Name: teams teams_sync_count_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER teams_sync_count_ins AFTER INSERT ON public.teams FOR EACH ROW EXECUTE FUNCTION public.teams_sync_billable_count();


--
-- Name: teams teams_sync_count_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER teams_sync_count_upd AFTER UPDATE OF archived_at, club_id ON public.teams FOR EACH ROW EXECUTE FUNCTION public.teams_sync_billable_count();


--
-- Name: billing_events billing_events_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_events
    ADD CONSTRAINT billing_events_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;


--
-- Name: club_invitations club_invitations_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_invitations
    ADD CONSTRAINT club_invitations_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_invitations club_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_invitations
    ADD CONSTRAINT club_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id);


--
-- Name: club_invitations club_invitations_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_invitations
    ADD CONSTRAINT club_invitations_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.club_roles(id) ON DELETE CASCADE;


--
-- Name: club_memberships club_memberships_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_memberships
    ADD CONSTRAINT club_memberships_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: club_memberships club_memberships_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_memberships
    ADD CONSTRAINT club_memberships_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.club_roles(id) ON DELETE RESTRICT;


--
-- Name: club_memberships club_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_memberships
    ADD CONSTRAINT club_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: club_roles club_roles_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.club_roles
    ADD CONSTRAINT club_roles_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: exercises exercises_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: exercises exercises_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: macrocycles macrocycles_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.macrocycles
    ADD CONSTRAINT macrocycles_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: macrocycles macrocycles_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.macrocycles
    ADD CONSTRAINT macrocycles_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mesocycles mesocycles_macrocycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesocycles
    ADD CONSTRAINT mesocycles_macrocycle_id_fkey FOREIGN KEY (macrocycle_id) REFERENCES public.macrocycles(id) ON DELETE CASCADE;


--
-- Name: mesocycles mesocycles_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mesocycles
    ADD CONSTRAINT mesocycles_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: microcycles microcycles_mesocycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.microcycles
    ADD CONSTRAINT microcycles_mesocycle_id_fkey FOREIGN KEY (mesocycle_id) REFERENCES public.mesocycles(id) ON DELETE CASCADE;


--
-- Name: microcycles microcycles_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.microcycles
    ADD CONSTRAINT microcycles_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: players players_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: players players_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_exercises session_exercises_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_exercises
    ADD CONSTRAINT session_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE RESTRICT;


--
-- Name: session_exercises session_exercises_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_exercises
    ADD CONSTRAINT session_exercises_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_preparations session_preparations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_preparations
    ADD CONSTRAINT session_preparations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_preparations session_preparations_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_preparations
    ADD CONSTRAINT session_preparations_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_microcycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_microcycle_id_fkey FOREIGN KEY (microcycle_id) REFERENCES public.microcycles(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: team_memberships team_memberships_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_memberships
    ADD CONSTRAINT team_memberships_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.club_memberships(id) ON DELETE CASCADE;


--
-- Name: team_memberships team_memberships_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_memberships
    ADD CONSTRAINT team_memberships_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams teams_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: teams teams_trainer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: billing_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_events billing_events_full_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_events_full_read ON public.billing_events FOR SELECT USING ((private.user_club_access(club_id) = 'full'::public.access_level));


--
-- Name: club_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: club_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: club_memberships club_memberships_full_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_memberships_full_delete ON public.club_memberships FOR DELETE USING ((private.user_club_access(club_id) = 'full'::public.access_level));


--
-- Name: club_memberships club_memberships_full_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_memberships_full_insert ON public.club_memberships FOR INSERT WITH CHECK ((private.user_club_access(club_id) = 'full'::public.access_level));


--
-- Name: club_memberships club_memberships_full_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_memberships_full_update ON public.club_memberships FOR UPDATE USING ((private.user_club_access(club_id) = 'full'::public.access_level)) WITH CHECK ((private.user_club_access(club_id) = 'full'::public.access_level));


--
-- Name: club_memberships club_memberships_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_memberships_read ON public.club_memberships FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level]))));


--
-- Name: club_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.club_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: club_roles club_roles_full_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_roles_full_delete ON public.club_roles FOR DELETE USING (((private.user_club_access(club_id) = 'full'::public.access_level) AND (NOT is_system)));


--
-- Name: club_roles club_roles_full_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_roles_full_insert ON public.club_roles FOR INSERT WITH CHECK (((private.user_club_access(club_id) = 'full'::public.access_level) AND (NOT is_system)));


--
-- Name: club_roles club_roles_full_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_roles_full_update ON public.club_roles FOR UPDATE USING (((private.user_club_access(club_id) = 'full'::public.access_level) AND (NOT is_system))) WITH CHECK (((private.user_club_access(club_id) = 'full'::public.access_level) AND (NOT is_system)));


--
-- Name: club_roles club_roles_member_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY club_roles_member_read ON public.club_roles FOR SELECT USING ((private.user_club_access(club_id) IS NOT NULL));


--
-- Name: clubs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

--
-- Name: clubs clubs_full_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clubs_full_update ON public.clubs FOR UPDATE USING ((private.user_club_access(id) = 'full'::public.access_level)) WITH CHECK ((private.user_club_access(id) = 'full'::public.access_level));


--
-- Name: clubs clubs_member_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clubs_member_read ON public.clubs FOR SELECT USING ((private.user_club_access(id) IS NOT NULL));


--
-- Name: exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

--
-- Name: exercises exercises_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exercises_delete ON public.exercises FOR DELETE USING ((((club_id IS NOT NULL) AND (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))) OR ((club_id IS NULL) AND (trainer_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: exercises exercises_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exercises_insert ON public.exercises FOR INSERT WITH CHECK ((((club_id IS NOT NULL) AND (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))) OR ((club_id IS NULL) AND (trainer_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: exercises exercises_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exercises_read ON public.exercises FOR SELECT USING ((((trainer_id IS NULL) AND (club_id IS NULL)) OR ((club_id IS NOT NULL) AND (private.user_club_access(club_id) IS NOT NULL)) OR ((club_id IS NULL) AND (trainer_id IS NOT NULL) AND (trainer_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: exercises exercises_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exercises_update ON public.exercises FOR UPDATE USING ((((club_id IS NOT NULL) AND (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))) OR ((club_id IS NULL) AND (trainer_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((((club_id IS NOT NULL) AND (private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))) OR ((club_id IS NULL) AND (trainer_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: club_invitations invitations_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invitations_admin_read ON public.club_invitations FOR SELECT USING ((private.user_club_access(club_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level])));


--
-- Name: club_invitations invitations_full_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invitations_full_delete ON public.club_invitations FOR DELETE USING ((private.user_club_access(club_id) = 'full'::public.access_level));


--
-- Name: club_invitations invitations_full_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invitations_full_insert ON public.club_invitations FOR INSERT WITH CHECK ((private.user_club_access(club_id) = 'full'::public.access_level));


--
-- Name: club_invitations invitations_full_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invitations_full_update ON public.club_invitations FOR UPDATE USING ((private.user_club_access(club_id) = 'full'::public.access_level)) WITH CHECK ((private.user_club_access(club_id) = 'full'::public.access_level));


--
-- Name: macrocycles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.macrocycles ENABLE ROW LEVEL SECURITY;

--
-- Name: macrocycles macrocycles_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY macrocycles_delete ON public.macrocycles FOR DELETE USING ((private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])));


--
-- Name: macrocycles macrocycles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY macrocycles_insert ON public.macrocycles FOR INSERT WITH CHECK ((private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])));


--
-- Name: macrocycles macrocycles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY macrocycles_read ON public.macrocycles FOR SELECT USING ((private.user_team_access(team_id) IS NOT NULL));


--
-- Name: macrocycles macrocycles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY macrocycles_update ON public.macrocycles FOR UPDATE USING ((private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))) WITH CHECK ((private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])));


--
-- Name: mesocycles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mesocycles ENABLE ROW LEVEL SECURITY;

--
-- Name: mesocycles mesocycles_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mesocycles_delete ON public.mesocycles FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.macrocycles m
  WHERE ((m.id = mesocycles.macrocycle_id) AND (private.user_team_access(m.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))))));


--
-- Name: mesocycles mesocycles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mesocycles_insert ON public.mesocycles FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.macrocycles m
  WHERE ((m.id = mesocycles.macrocycle_id) AND (private.user_team_access(m.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))))));


--
-- Name: mesocycles mesocycles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mesocycles_read ON public.mesocycles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.macrocycles m
  WHERE ((m.id = mesocycles.macrocycle_id) AND (private.user_team_access(m.team_id) IS NOT NULL)))));


--
-- Name: mesocycles mesocycles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mesocycles_update ON public.mesocycles FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.macrocycles m
  WHERE ((m.id = mesocycles.macrocycle_id) AND (private.user_team_access(m.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.macrocycles m
  WHERE ((m.id = mesocycles.macrocycle_id) AND (private.user_team_access(m.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))))));


--
-- Name: microcycles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.microcycles ENABLE ROW LEVEL SECURITY;

--
-- Name: microcycles microcycles_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY microcycles_delete ON public.microcycles FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.mesocycles me
     JOIN public.macrocycles ma ON ((ma.id = me.macrocycle_id)))
  WHERE ((me.id = microcycles.mesocycle_id) AND (private.user_team_access(ma.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))))));


--
-- Name: microcycles microcycles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY microcycles_insert ON public.microcycles FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.mesocycles me
     JOIN public.macrocycles ma ON ((ma.id = me.macrocycle_id)))
  WHERE ((me.id = microcycles.mesocycle_id) AND (private.user_team_access(ma.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))))));


--
-- Name: microcycles microcycles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY microcycles_read ON public.microcycles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.mesocycles me
     JOIN public.macrocycles ma ON ((ma.id = me.macrocycle_id)))
  WHERE ((me.id = microcycles.mesocycle_id) AND (private.user_team_access(ma.team_id) IS NOT NULL)))));


--
-- Name: microcycles microcycles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY microcycles_update ON public.microcycles FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.mesocycles me
     JOIN public.macrocycles ma ON ((ma.id = me.macrocycle_id)))
  WHERE ((me.id = microcycles.mesocycle_id) AND (private.user_team_access(ma.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.mesocycles me
     JOIN public.macrocycles ma ON ((ma.id = me.macrocycle_id)))
  WHERE ((me.id = microcycles.mesocycle_id) AND (private.user_team_access(ma.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level]))))));


--
-- Name: players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

--
-- Name: players players_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY players_delete ON public.players FOR DELETE USING (((private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = players.team_id) AND private.club_is_active(t.club_id))))));


--
-- Name: players players_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY players_insert ON public.players FOR INSERT WITH CHECK (((private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = players.team_id) AND private.club_is_active(t.club_id))))));


--
-- Name: players players_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY players_read ON public.players FOR SELECT USING ((private.user_team_access(team_id) IS NOT NULL));


--
-- Name: players players_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY players_update ON public.players FOR UPDATE USING (((private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = players.team_id) AND private.club_is_active(t.club_id)))))) WITH CHECK (((private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = players.team_id) AND private.club_is_active(t.club_id))))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_read ON public.profiles FOR SELECT USING (((( SELECT auth.uid() AS uid) = id) OR (EXISTS ( SELECT 1
   FROM (public.club_memberships m1
     JOIN public.club_memberships m2 ON ((m2.club_id = m1.club_id)))
  WHERE ((m1.user_id = ( SELECT auth.uid() AS uid)) AND (m2.user_id = profiles.id))))));


--
-- Name: profiles profiles_self_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));


--
-- Name: session_exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;

--
-- Name: session_exercises session_exercises_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_exercises_delete ON public.session_exercises FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = session_exercises.session_id) AND ((private.user_team_access(s.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) OR ((s.team_id IS NULL) AND (s.trainer_id = ( SELECT auth.uid() AS uid))))))));


--
-- Name: session_exercises session_exercises_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_exercises_insert ON public.session_exercises FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = session_exercises.session_id) AND ((private.user_team_access(s.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) OR ((s.team_id IS NULL) AND (s.trainer_id = ( SELECT auth.uid() AS uid))))))));


--
-- Name: session_exercises session_exercises_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_exercises_read ON public.session_exercises FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = session_exercises.session_id) AND ((private.user_team_access(s.team_id) IS NOT NULL) OR ((s.team_id IS NULL) AND (s.trainer_id = ( SELECT auth.uid() AS uid))))))));


--
-- Name: session_exercises session_exercises_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_exercises_update ON public.session_exercises FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = session_exercises.session_id) AND ((private.user_team_access(s.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) OR ((s.team_id IS NULL) AND (s.trainer_id = ( SELECT auth.uid() AS uid)))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = session_exercises.session_id) AND ((private.user_team_access(s.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) OR ((s.team_id IS NULL) AND (s.trainer_id = ( SELECT auth.uid() AS uid))))))));


--
-- Name: session_preparations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_preparations ENABLE ROW LEVEL SECURITY;

--
-- Name: session_preparations session_preparations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_preparations_delete ON public.session_preparations FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = session_preparations.session_id) AND ((private.user_team_access(s.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) OR ((s.team_id IS NULL) AND (s.trainer_id = ( SELECT auth.uid() AS uid))))))));


--
-- Name: session_preparations session_preparations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_preparations_insert ON public.session_preparations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = session_preparations.session_id) AND ((private.user_team_access(s.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) OR ((s.team_id IS NULL) AND (s.trainer_id = ( SELECT auth.uid() AS uid))))))));


--
-- Name: session_preparations session_preparations_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_preparations_read ON public.session_preparations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = session_preparations.session_id) AND ((private.user_team_access(s.team_id) IS NOT NULL) OR ((s.team_id IS NULL) AND (s.trainer_id = ( SELECT auth.uid() AS uid))))))));


--
-- Name: session_preparations session_preparations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_preparations_update ON public.session_preparations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = session_preparations.session_id) AND ((private.user_team_access(s.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) OR ((s.team_id IS NULL) AND (s.trainer_id = ( SELECT auth.uid() AS uid)))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = session_preparations.session_id) AND ((private.user_team_access(s.team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) OR ((s.team_id IS NULL) AND (s.trainer_id = ( SELECT auth.uid() AS uid))))))));


--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions sessions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_delete ON public.sessions FOR DELETE USING ((((private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = sessions.team_id) AND private.club_is_active(t.club_id))))) OR ((team_id IS NULL) AND (trainer_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: sessions sessions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_insert ON public.sessions FOR INSERT WITH CHECK ((((private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = sessions.team_id) AND private.club_is_active(t.club_id))))) OR ((team_id IS NULL) AND (trainer_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: sessions sessions_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_read ON public.sessions FOR SELECT USING (((private.user_team_access(team_id) IS NOT NULL) OR ((team_id IS NULL) AND (trainer_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: sessions sessions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_update ON public.sessions FOR UPDATE USING ((((private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = sessions.team_id) AND private.club_is_active(t.club_id))))) OR ((team_id IS NULL) AND (trainer_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((((private.user_team_access(team_id) = ANY (ARRAY['full'::public.access_level, 'extended'::public.access_level, 'team'::public.access_level])) AND (EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = sessions.team_id) AND private.club_is_active(t.club_id))))) OR ((team_id IS NULL) AND (trainer_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: team_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: team_memberships team_memberships_full_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_memberships_full_delete ON public.team_memberships FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = team_memberships.team_id) AND (private.user_club_access(t.club_id) = 'full'::public.access_level)))));


--
-- Name: team_memberships team_memberships_full_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_memberships_full_insert ON public.team_memberships FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = team_memberships.team_id) AND (private.user_club_access(t.club_id) = 'full'::public.access_level)))));


--
-- Name: team_memberships team_memberships_full_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_memberships_full_update ON public.team_memberships FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = team_memberships.team_id) AND (private.user_club_access(t.club_id) = 'full'::public.access_level))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = team_memberships.team_id) AND (private.user_club_access(t.club_id) = 'full'::public.access_level)))));


--
-- Name: team_memberships team_memberships_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_memberships_read ON public.team_memberships FOR SELECT USING (((private.user_team_access(team_id) IS NOT NULL) OR (EXISTS ( SELECT 1
   FROM public.club_memberships m
  WHERE ((m.id = team_memberships.membership_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: teams teams_full_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teams_full_delete ON public.teams FOR DELETE USING (((private.user_club_access(club_id) = 'full'::public.access_level) AND private.club_is_active(club_id)));


--
-- Name: teams teams_full_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teams_full_insert ON public.teams FOR INSERT WITH CHECK (((private.user_club_access(club_id) = 'full'::public.access_level) AND private.club_is_active(club_id)));


--
-- Name: teams teams_full_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teams_full_update ON public.teams FOR UPDATE USING (((private.user_club_access(club_id) = 'full'::public.access_level) AND private.club_is_active(club_id))) WITH CHECK (((private.user_club_access(club_id) = 'full'::public.access_level) AND private.club_is_active(club_id)));


--
-- Name: teams teams_member_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teams_member_read ON public.teams FOR SELECT USING ((private.user_team_access(id) IS NOT NULL));


--
-- Name: SCHEMA private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA private TO authenticated;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION club_is_active(p_club_id uuid); Type: ACL; Schema: private; Owner: -
--

GRANT ALL ON FUNCTION private.club_is_active(p_club_id uuid) TO authenticated;


--
-- Name: FUNCTION user_club_access(p_club_id uuid); Type: ACL; Schema: private; Owner: -
--

GRANT ALL ON FUNCTION private.user_club_access(p_club_id uuid) TO authenticated;


--
-- Name: FUNCTION user_team_access(p_team_id uuid); Type: ACL; Schema: private; Owner: -
--

GRANT ALL ON FUNCTION private.user_team_access(p_team_id uuid) TO authenticated;


--
-- Name: FUNCTION accept_invitation(p_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.accept_invitation(p_token text) TO anon;
GRANT ALL ON FUNCTION public.accept_invitation(p_token text) TO authenticated;
GRANT ALL ON FUNCTION public.accept_invitation(p_token text) TO service_role;


--
-- Name: FUNCTION accept_my_invitation(p_invitation_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.accept_my_invitation(p_invitation_id uuid) TO anon;
GRANT ALL ON FUNCTION public.accept_my_invitation(p_invitation_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.accept_my_invitation(p_invitation_id uuid) TO service_role;


--
-- Name: FUNCTION archive_team(p_team_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.archive_team(p_team_id uuid) TO anon;
GRANT ALL ON FUNCTION public.archive_team(p_team_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.archive_team(p_team_id uuid) TO service_role;


--
-- Name: FUNCTION create_club(p_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_club(p_name text) TO anon;
GRANT ALL ON FUNCTION public.create_club(p_name text) TO authenticated;
GRANT ALL ON FUNCTION public.create_club(p_name text) TO service_role;


--
-- Name: FUNCTION create_invitation(p_club_id uuid, p_email text, p_role_id uuid, p_team_ids uuid[], p_ttl_hours integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_invitation(p_club_id uuid, p_email text, p_role_id uuid, p_team_ids uuid[], p_ttl_hours integer) TO anon;
GRANT ALL ON FUNCTION public.create_invitation(p_club_id uuid, p_email text, p_role_id uuid, p_team_ids uuid[], p_ttl_hours integer) TO authenticated;
GRANT ALL ON FUNCTION public.create_invitation(p_club_id uuid, p_email text, p_role_id uuid, p_team_ids uuid[], p_ttl_hours integer) TO service_role;


--
-- Name: FUNCTION create_team(p_club_id uuid, p_name text, p_season text, p_age_group text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_team(p_club_id uuid, p_name text, p_season text, p_age_group text) TO anon;
GRANT ALL ON FUNCTION public.create_team(p_club_id uuid, p_name text, p_season text, p_age_group text) TO authenticated;
GRANT ALL ON FUNCTION public.create_team(p_club_id uuid, p_name text, p_season text, p_age_group text) TO service_role;


--
-- Name: FUNCTION delete_team_permanently(p_team_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_team_permanently(p_team_id uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_team_permanently(p_team_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_team_permanently(p_team_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION my_pending_invitations(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.my_pending_invitations() TO anon;
GRANT ALL ON FUNCTION public.my_pending_invitations() TO authenticated;
GRANT ALL ON FUNCTION public.my_pending_invitations() TO service_role;


--
-- Name: FUNCTION preview_invitation(p_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.preview_invitation(p_token text) TO anon;
GRANT ALL ON FUNCTION public.preview_invitation(p_token text) TO authenticated;
GRANT ALL ON FUNCTION public.preview_invitation(p_token text) TO service_role;


--
-- Name: FUNCTION restore_team(p_team_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.restore_team(p_team_id uuid) TO anon;
GRANT ALL ON FUNCTION public.restore_team(p_team_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.restore_team(p_team_id uuid) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION teams_sync_billable_count(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.teams_sync_billable_count() TO anon;
GRANT ALL ON FUNCTION public.teams_sync_billable_count() TO authenticated;
GRANT ALL ON FUNCTION public.teams_sync_billable_count() TO service_role;


--
-- Name: FUNCTION update_team(p_team_id uuid, p_name text, p_season text, p_age_group text, p_description text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_team(p_team_id uuid, p_name text, p_season text, p_age_group text, p_description text) TO anon;
GRANT ALL ON FUNCTION public.update_team(p_team_id uuid, p_name text, p_season text, p_age_group text, p_description text) TO authenticated;
GRANT ALL ON FUNCTION public.update_team(p_team_id uuid, p_name text, p_season text, p_age_group text, p_description text) TO service_role;


--
-- Name: FUNCTION update_team(p_team_id uuid, p_name text, p_season text, p_age_group text, p_description text, p_photo_url text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_team(p_team_id uuid, p_name text, p_season text, p_age_group text, p_description text, p_photo_url text) TO anon;
GRANT ALL ON FUNCTION public.update_team(p_team_id uuid, p_name text, p_season text, p_age_group text, p_description text, p_photo_url text) TO authenticated;
GRANT ALL ON FUNCTION public.update_team(p_team_id uuid, p_name text, p_season text, p_age_group text, p_description text, p_photo_url text) TO service_role;


--
-- Name: TABLE billing_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.billing_events TO anon;
GRANT ALL ON TABLE public.billing_events TO authenticated;
GRANT ALL ON TABLE public.billing_events TO service_role;


--
-- Name: TABLE club_invitations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.club_invitations TO anon;
GRANT ALL ON TABLE public.club_invitations TO authenticated;
GRANT ALL ON TABLE public.club_invitations TO service_role;


--
-- Name: TABLE club_memberships; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.club_memberships TO anon;
GRANT ALL ON TABLE public.club_memberships TO authenticated;
GRANT ALL ON TABLE public.club_memberships TO service_role;


--
-- Name: TABLE club_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.club_roles TO anon;
GRANT ALL ON TABLE public.club_roles TO authenticated;
GRANT ALL ON TABLE public.club_roles TO service_role;


--
-- Name: TABLE clubs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.clubs TO anon;
GRANT ALL ON TABLE public.clubs TO authenticated;
GRANT ALL ON TABLE public.clubs TO service_role;


--
-- Name: TABLE exercises; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exercises TO anon;
GRANT ALL ON TABLE public.exercises TO authenticated;
GRANT ALL ON TABLE public.exercises TO service_role;


--
-- Name: TABLE macrocycles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.macrocycles TO anon;
GRANT ALL ON TABLE public.macrocycles TO authenticated;
GRANT ALL ON TABLE public.macrocycles TO service_role;


--
-- Name: TABLE mesocycles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mesocycles TO anon;
GRANT ALL ON TABLE public.mesocycles TO authenticated;
GRANT ALL ON TABLE public.mesocycles TO service_role;


--
-- Name: TABLE microcycles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.microcycles TO anon;
GRANT ALL ON TABLE public.microcycles TO authenticated;
GRANT ALL ON TABLE public.microcycles TO service_role;


--
-- Name: TABLE players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.players TO anon;
GRANT ALL ON TABLE public.players TO authenticated;
GRANT ALL ON TABLE public.players TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE session_exercises; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.session_exercises TO anon;
GRANT ALL ON TABLE public.session_exercises TO authenticated;
GRANT ALL ON TABLE public.session_exercises TO service_role;


--
-- Name: TABLE session_preparations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.session_preparations TO anon;
GRANT ALL ON TABLE public.session_preparations TO authenticated;
GRANT ALL ON TABLE public.session_preparations TO service_role;


--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sessions TO anon;
GRANT ALL ON TABLE public.sessions TO authenticated;
GRANT ALL ON TABLE public.sessions TO service_role;


--
-- Name: TABLE team_memberships; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_memberships TO anon;
GRANT ALL ON TABLE public.team_memberships TO authenticated;
GRANT ALL ON TABLE public.team_memberships TO service_role;


--
-- Name: TABLE teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teams TO anon;
GRANT ALL ON TABLE public.teams TO authenticated;
GRANT ALL ON TABLE public.teams TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--


