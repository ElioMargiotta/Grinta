-- Admin club lifecycle for the platform console: archive (reversible),
-- restore, hard delete (irreversible, cascades through every club_id FK), plus
-- a member-activity RPC exposing last connection time from auth.users.
--
-- All RPCs are self-guarded by is_platform_admin().

-- ---------------------------------------------------------------------------
-- 1. Soft-archive flag on clubs. Archiving suspends the licence so the club
--    becomes inaccessible (locked) to its members until restored.
-- ---------------------------------------------------------------------------
alter table public.clubs add column if not exists archived_at timestamptz;
create index if not exists clubs_archived_idx on public.clubs (archived_at);

create or replace function public.admin_archive_club(p_club_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  update public.clubs
     set archived_at = now(), updated_at = now()
   where id = p_club_id and archived_at is null;
  if not found then
    raise exception 'club_not_found_or_archived';
  end if;

  -- Suspend the licence so writes/reads are gated while archived.
  update public.club_licenses set status = 'suspended' where club_id = p_club_id;

  insert into public.license_events (club_id, actor, event_type, payload)
  values (p_club_id, auth.uid(), 'archived', '{}'::jsonb);
end $$;

create or replace function public.admin_restore_club(p_club_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  update public.clubs
     set archived_at = null, updated_at = now()
   where id = p_club_id and archived_at is not null;
  if not found then
    raise exception 'club_not_archived';
  end if;

  update public.club_licenses set status = 'active' where club_id = p_club_id;

  insert into public.license_events (club_id, actor, event_type, payload)
  values (p_club_id, auth.uid(), 'restored', '{}'::jsonb);
end $$;

-- Irreversible hard delete. Every club_id FK is ON DELETE CASCADE (billing_events
-- is SET NULL), so removing the club row tears down all of its data. The caller
-- must re-type the exact club name as a safety interlock.
create or replace function public.admin_delete_club(
  p_club_id      uuid,
  p_confirm_name text
)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  select name into v_name from public.clubs where id = p_club_id;
  if v_name is null then
    raise exception 'club_not_found';
  end if;
  if trim(coalesce(p_confirm_name, '')) is distinct from v_name then
    raise exception 'name_mismatch';
  end if;

  delete from public.clubs where id = p_club_id;
end $$;

revoke all on function public.admin_archive_club(uuid) from public;
revoke all on function public.admin_restore_club(uuid) from public;
revoke all on function public.admin_delete_club(uuid, text) from public;
grant execute on function public.admin_archive_club(uuid) to authenticated, service_role;
grant execute on function public.admin_restore_club(uuid) to authenticated, service_role;
grant execute on function public.admin_delete_club(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Members + connection activity. Joins club_memberships → profiles →
--    auth.users to surface each member's last_sign_in_at (not otherwise
--    readable under RLS). Powers the club detail "activity" panel.
-- ---------------------------------------------------------------------------
create or replace function public.admin_club_members(p_club_id uuid)
  returns table (
    user_id          uuid,
    full_name        text,
    role_name        text,
    access_level     public.access_level,
    joined_at        timestamptz,
    last_sign_in_at  timestamptz
  )
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select
    m.user_id,
    p.full_name,
    r.name,
    r.access_level,
    m.created_at,
    u.last_sign_in_at
  from public.club_memberships m
  join public.club_roles r on r.id = m.role_id
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.club_id = p_club_id
    and public.is_platform_admin()
  order by u.last_sign_in_at desc nulls last;
$$;

revoke all on function public.admin_club_members(uuid) from public;
grant execute on function public.admin_club_members(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Surface archived_at in the dashboard overview so the clubs list can split
--    active vs archived. Re-creates admin_clubs_overview with one extra column.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_clubs_overview();
create or replace function public.admin_clubs_overview()
  returns table (
    club_id         uuid,
    name            text,
    created_at      timestamptz,
    archived_at     timestamptz,
    state           text,
    status          public.license_status,
    auto_renew      boolean,
    ends_at         timestamptz,
    quote_reference text,
    teams           integer,
    players         integer,
    staff           integer,
    max_teams       integer,
    max_players     integer,
    max_staff       integer
  )
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select
    c.id,
    c.name,
    c.created_at,
    c.archived_at,
    public.club_license_state(c.id),
    l.status,
    l.auto_renew,
    l.ends_at,
    l.quote_reference,
    public.club_team_count(c.id),
    public.club_player_count(c.id),
    public.club_staff_count(c.id),
    l.max_teams,
    l.max_players,
    l.max_staff
  from public.clubs c
  left join public.club_licenses l on l.club_id = c.id
  where public.is_platform_admin()
  order by c.created_at desc;
$$;

revoke all on function public.admin_clubs_overview() from public;
grant execute on function public.admin_clubs_overview() to authenticated, service_role;
