-- =====================================================================
-- 0012 — Multi-tenant migration: club + roles + memberships + billing
-- =====================================================================
-- Introduces the club tenant on top of the existing single-trainer model.
--
-- New tables:   clubs, club_roles, club_memberships, team_memberships,
--               club_invitations, billing_events
-- Altered:      teams (+club_id, +archived_at), exercises (+club_id)
--
-- Backfill: one club per existing trainer (Espace personnel),
--           seeded with system roles "Propriétaire" (full) + "Coach" (team),
--           and a 30-day trial.
--
-- RLS policies are REWRITTEN in 0013_rls_rewrite.sql.
-- Do NOT run 0012 without immediately running 0013 — the old
-- "own X" policies are dropped at the end of this migration.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- access_level enum (system-defined, immutable from app)
-- ---------------------------------------------------------------------
do $$ begin
  create type access_level as enum ('full', 'extended', 'team', 'team_readonly');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Stripe / billing
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  subscription_status    text not null default 'trialing'
    check (subscription_status in ('trialing','active','past_due','canceled','incomplete','paused')),
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,

  -- Denormalized count of billable (non-archived) teams; kept in sync via trigger.
  billable_team_count int not null default 0
);

create index if not exists clubs_subscription_status_idx on clubs (subscription_status);

-- ---------------------------------------------------------------------
-- club_roles  (custom labels per club, fixed access_level enum)
-- ---------------------------------------------------------------------
create table if not exists club_roles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  access_level access_level not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (club_id, name)
);

create index if not exists club_roles_club_idx on club_roles (club_id);

-- ---------------------------------------------------------------------
-- club_memberships  (user ↔ club ↔ role)
-- ---------------------------------------------------------------------
create table if not exists club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references club_roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create index if not exists club_memberships_user_idx on club_memberships (user_id);
create index if not exists club_memberships_club_idx on club_memberships (club_id);

-- ---------------------------------------------------------------------
-- team_memberships  (only meaningful for access_level team / team_readonly)
-- ---------------------------------------------------------------------
create table if not exists team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  membership_id uuid not null references club_memberships(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, membership_id)
);

create index if not exists team_memberships_team_idx on team_memberships (team_id);
create index if not exists team_memberships_membership_idx on team_memberships (membership_id);

-- ---------------------------------------------------------------------
-- club_invitations  (email-based onboarding)
-- ---------------------------------------------------------------------
create table if not exists club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  email text not null,
  role_id uuid not null references club_roles(id) on delete cascade,
  team_ids uuid[] not null default '{}',
  invited_by uuid not null references profiles(id),
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only one pending invite per (club, email); accepted rows stay for audit.
create unique index if not exists club_invitations_pending_uniq
  on club_invitations (club_id, email) where accepted_at is null;

-- ---------------------------------------------------------------------
-- billing_events  (raw Stripe webhook audit log, idempotency)
-- ---------------------------------------------------------------------
create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete set null,
  stripe_event_id text unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create index if not exists billing_events_club_idx on billing_events (club_id, processed_at desc);

-- ---------------------------------------------------------------------
-- Extend teams + exercises with club_id
-- ---------------------------------------------------------------------
alter table teams
  add column if not exists club_id uuid references clubs(id) on delete cascade,
  add column if not exists archived_at timestamptz;

alter table exercises
  add column if not exists club_id uuid references clubs(id) on delete cascade;

-- ---------------------------------------------------------------------
-- BACKFILL: 1 club per existing trainer
-- ---------------------------------------------------------------------
do $$
declare
  t record;
  v_club_id uuid;
  v_owner_role_id uuid;
begin
  for t in select id, full_name from profiles loop
    insert into clubs (name, subscription_status, trial_ends_at)
    values (
      coalesce(nullif(t.full_name, ''), 'Mon club') || ' — Espace personnel',
      'trialing',
      now() + interval '30 days'
    )
    returning id into v_club_id;

    -- Seed system roles
    insert into club_roles (club_id, name, access_level, is_system)
    values (v_club_id, 'Propriétaire', 'full', true)
    returning id into v_owner_role_id;

    insert into club_roles (club_id, name, access_level, is_system)
    values (v_club_id, 'Coach', 'team', true);

    -- Owner membership
    insert into club_memberships (club_id, user_id, role_id)
    values (v_club_id, t.id, v_owner_role_id);

    -- Attach all of this trainer's teams + exercises to the club
    update teams     set club_id = v_club_id where trainer_id = t.id;
    update exercises set club_id = v_club_id where trainer_id = t.id;
  end loop;
end $$;

-- After backfill, club_id on teams becomes mandatory.
alter table teams alter column club_id set not null;

-- Sync billable_team_count
update clubs c set billable_team_count = (
  select count(*) from teams where club_id = c.id and archived_at is null
);

-- ---------------------------------------------------------------------
-- updated_at trigger for clubs
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists clubs_set_updated_at on clubs;
create trigger clubs_set_updated_at
before update on clubs
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- billable_team_count maintenance trigger
-- ---------------------------------------------------------------------
create or replace function teams_sync_billable_count()
returns trigger language plpgsql as $$
declare
  v_club_id uuid;
begin
  v_club_id := coalesce(new.club_id, old.club_id);
  update clubs
     set billable_team_count = (
       select count(*) from teams
       where club_id = v_club_id and archived_at is null
     )
   where id = v_club_id;
  return null;
end $$;

drop trigger if exists teams_sync_count_ins on teams;
create trigger teams_sync_count_ins
after insert on teams
for each row execute function teams_sync_billable_count();

drop trigger if exists teams_sync_count_upd on teams;
create trigger teams_sync_count_upd
after update of archived_at, club_id on teams
for each row execute function teams_sync_billable_count();

drop trigger if exists teams_sync_count_del on teams;
create trigger teams_sync_count_del
after delete on teams
for each row execute function teams_sync_billable_count();

-- ---------------------------------------------------------------------
-- Drop legacy "own X" RLS policies. They are replaced in 0013.
-- ---------------------------------------------------------------------
drop policy if exists "own profile"               on profiles;
drop policy if exists "own teams"                 on teams;
drop policy if exists "own players"               on players;
drop policy if exists "read exercises"            on exercises;
drop policy if exists "write exercises"           on exercises;
drop policy if exists "own sessions"              on sessions;
drop policy if exists "own session_exercises"     on session_exercises;
drop policy if exists "own session_preparations"  on session_preparations;
drop policy if exists "own macrocycles"           on macrocycles;
drop policy if exists "own mesocycles"            on mesocycles;
drop policy if exists "own microcycles"           on microcycles;

-- Enable RLS on new tables (policies in 0013)
alter table clubs              enable row level security;
alter table club_roles         enable row level security;
alter table club_memberships   enable row level security;
alter table team_memberships   enable row level security;
alter table club_invitations   enable row level security;
alter table billing_events     enable row level security;
