-- Licence model. Each club is provisioned by a platform admin under a licence
-- that defines hard quotas (teams / players / staff) and a validity window.
-- The effective access state derived from the licence replaces the Stripe
-- subscription as the read/write gate (see 20260625100200 for enforcement).

create type public.license_status as enum ('active', 'suspended', 'expired');

create table if not exists public.club_licenses (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null unique references public.clubs (id) on delete cascade,
  status          public.license_status not null default 'active',
  max_teams       integer,  -- null = unlimited
  max_players     integer,  -- null = unlimited
  max_staff       integer,  -- null = unlimited
  auto_renew      boolean not null default true,
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,  -- null = open-ended (relevant only when auto_renew is false)
  grace_days      integer not null default 30,  -- read-only window after ends_at before data is locked
  quote_reference text,
  notes           text,
  created_by      uuid references auth.users (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint club_licenses_max_teams_nonneg   check (max_teams   is null or max_teams   >= 0),
  constraint club_licenses_max_players_nonneg check (max_players is null or max_players >= 0),
  constraint club_licenses_max_staff_nonneg   check (max_staff   is null or max_staff   >= 0),
  constraint club_licenses_grace_days_nonneg  check (grace_days >= 0)
);

create trigger club_licenses_set_updated_at
  before update on public.club_licenses
  for each row execute function public.set_updated_at();

alter table public.club_licenses enable row level security;

-- Audit trail for licence lifecycle (created / updated / suspended / reactivated).
create table if not exists public.license_events (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  actor      uuid references auth.users (id),
  event_type text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists license_events_club_idx on public.license_events (club_id, created_at desc);

alter table public.license_events enable row level security;

-- Effective access state, computed from status + validity window + grace period:
--   active : full access (read + write)
--   grace  : read-only — data still visible, within grace_days after ends_at
--   locked : data no longer readable — suspended/expired, or past the grace window
create or replace function public.club_license_state(p_club_id uuid)
  returns text
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $$
declare
  v public.club_licenses;
begin
  select * into v from public.club_licenses where club_id = p_club_id;

  -- No licence row → treat as active (legacy clubs are backfilled below; this
  -- only guards a transient window during migration).
  if not found then
    return 'active';
  end if;

  if v.status in ('suspended', 'expired') then
    return 'locked';
  end if;

  -- status = active: auto-renew keeps it alive regardless of ends_at.
  if v.auto_renew or v.ends_at is null then
    return 'active';
  end if;

  if now() <= v.ends_at then
    return 'active';
  elsif now() <= v.ends_at + make_interval(days => v.grace_days) then
    return 'grace';
  else
    return 'locked';
  end if;
end $$;

revoke all on function public.club_license_state(uuid) from public;
grant execute on function public.club_license_state(uuid) to authenticated, service_role;

-- Usage counters (also reused by enforcement triggers and the admin dashboard).
create or replace function public.club_team_count(p_club_id uuid)
  returns integer language sql stable security definer set search_path to 'public'
as $$ select count(*)::int from public.teams
        where club_id = p_club_id and archived_at is null $$;

create or replace function public.club_player_count(p_club_id uuid)
  returns integer language sql stable security definer set search_path to 'public'
as $$ select count(*)::int from public.players where club_id = p_club_id $$;

create or replace function public.club_staff_count(p_club_id uuid)
  returns integer language sql stable security definer set search_path to 'public'
as $$ select count(*)::int from public.club_memberships where club_id = p_club_id $$;

-- Single-call snapshot for the UI (Topbar usage chip, admin detail, quota gating).
create or replace function public.club_license_usage(p_club_id uuid)
  returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select jsonb_build_object(
    'state',           public.club_license_state(p_club_id),
    'status',          l.status,
    'auto_renew',      l.auto_renew,
    'starts_at',       l.starts_at,
    'ends_at',         l.ends_at,
    'grace_days',      l.grace_days,
    'quote_reference', l.quote_reference,
    'teams',           public.club_team_count(p_club_id),
    'players',         public.club_player_count(p_club_id),
    'staff',           public.club_staff_count(p_club_id),
    'max_teams',       l.max_teams,
    'max_players',     l.max_players,
    'max_staff',       l.max_staff
  )
  from public.club_licenses l
  where l.club_id = p_club_id;
$$;

revoke all on function public.club_team_count(uuid)    from public;
revoke all on function public.club_player_count(uuid)  from public;
revoke all on function public.club_staff_count(uuid)   from public;
revoke all on function public.club_license_usage(uuid) from public;
grant execute on function public.club_team_count(uuid)    to authenticated, service_role;
grant execute on function public.club_player_count(uuid)  to authenticated, service_role;
grant execute on function public.club_staff_count(uuid)   to authenticated, service_role;
grant execute on function public.club_license_usage(uuid) to authenticated, service_role;

-- RLS: platform admins manage everything; club members may read their own
-- club's licence (to surface usage). Writes go through admin RPCs only.
create policy club_licenses_admin_all on public.club_licenses
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy club_licenses_member_read on public.club_licenses
  for select to authenticated
  using (private.user_club_access(club_id) is not null);

create policy license_events_admin_all on public.license_events
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update, delete on table public.club_licenses to authenticated, service_role;
grant select, insert, delete on table public.license_events to authenticated, service_role;

-- Backfill: every existing club gets an active, auto-renewing, unlimited licence
-- so nothing breaks for clubs created before this model.
insert into public.club_licenses (club_id, status, auto_renew, max_teams, max_players, max_staff)
select c.id, 'active', true, null, null, null
from public.clubs c
where not exists (
  select 1 from public.club_licenses l where l.club_id = c.id
);
