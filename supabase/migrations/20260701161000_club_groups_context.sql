-- Phase 2 — Option B : un regroupement est un club-contexte.
--
-- Le regroupement possède donc ses propres équipes, joueurs, staff et quotas via
-- le moteur multi-tenant existant (`club_id`). La table ci-dessous ne porte que
-- la composition structurelle du groupement ASF : elle relie le club-contexte
-- (`clubs.is_group = true`) aux clubs membres.

alter table public.clubs
  add column if not exists is_group boolean not null default false;
create index if not exists clubs_is_group_idx on public.clubs (is_group);

create temporary table legacy_club_groups_to_context
  on commit drop
as
select
  g.id,
  g.name,
  g.created_at,
  g.updated_at,
  g.archived_at,
  array_remove(array_agg(m.club_id), null) as member_club_ids
from public.club_groups g
left join public.club_group_members m on m.group_id = g.id
group by g.id, g.name, g.created_at, g.updated_at, g.archived_at;

drop function if exists public.admin_create_club_group(text, uuid[]) cascade;
drop function if exists public.admin_update_club_group(uuid, text, uuid[]) cascade;
drop function if exists public.admin_archive_club_group(uuid) cascade;
drop function if exists public.admin_delete_club_group(uuid) cascade;
drop function if exists private.user_in_club_group(uuid) cascade;

drop table if exists public.club_group_members;
drop table if exists public.club_groups cascade;

create table if not exists public.club_group_members (
  group_club_id  uuid not null references public.clubs(id) on delete cascade,
  member_club_id uuid not null references public.clubs(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (group_club_id, member_club_id),
  constraint club_group_members_no_self check (group_club_id <> member_club_id)
);
create index if not exists club_group_members_member_idx
  on public.club_group_members (member_club_id);

insert into public.clubs (id, name, is_group, created_at, updated_at, archived_at)
select id, name, true, created_at, updated_at, archived_at
from legacy_club_groups_to_context
on conflict (id) do update
  set name = excluded.name,
      is_group = true,
      updated_at = excluded.updated_at,
      archived_at = excluded.archived_at;

insert into public.club_roles (club_id, name, access_level, is_system)
select l.id, 'Propriétaire', 'full', true
from legacy_club_groups_to_context l
where not exists (
  select 1 from public.club_roles r
  where r.club_id = l.id and r.access_level = 'full' and r.is_system
);

insert into public.club_roles (club_id, name, access_level, is_system)
select l.id, 'Coach', 'team', true
from legacy_club_groups_to_context l
where not exists (
  select 1 from public.club_roles r
  where r.club_id = l.id and r.access_level = 'team' and r.is_system
);

insert into public.club_licenses
  (club_id, status, auto_renew, max_teams, max_players, max_staff, notes, created_at, updated_at)
select
  l.id,
  'active',
  true,
  null,
  null,
  null,
  'Regroupement migré: quotas actifs, pas de facturation automatique.',
  l.created_at,
  l.updated_at
from legacy_club_groups_to_context l
on conflict (club_id) do nothing;

insert into public.club_group_members (group_club_id, member_club_id)
select l.id, member_id
from legacy_club_groups_to_context l
cross join lateral unnest(l.member_club_ids) as member_id
on conflict do nothing;

create or replace function private.user_in_group_context(p_group_club_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists (
    select 1
    from public.club_group_members m
    join public.club_memberships cm on cm.club_id = m.member_club_id
    where m.group_club_id = p_group_club_id
      and cm.user_id = auth.uid()
  );
$$;

alter table public.club_group_members enable row level security;

create policy club_group_members_read on public.club_group_members
  for select using (
    public.is_platform_admin()
    or private.user_club_access(group_club_id) is not null
    or private.user_in_group_context(group_club_id)
  );

create or replace function private.assert_valid_group_members(
  p_group_club_id uuid,
  p_member_club_ids uuid[]
)
  returns uuid[]
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $$
declare
  v_ids uuid[];
begin
  select array_agg(distinct x) into v_ids from unnest(p_member_club_ids) as x;
  if v_ids is null or array_length(v_ids, 1) < 2 or array_length(v_ids, 1) > 6 then
    raise exception 'invalid_member_count';
  end if;
  if p_group_club_id is not null and p_group_club_id = any(v_ids) then
    raise exception 'group_cannot_be_member';
  end if;
  if exists (
    select 1
    from unnest(v_ids) as x
    left join public.clubs c on c.id = x and c.is_group = false
    where c.id is null
  ) then
    raise exception 'member_club_not_found';
  end if;
  return v_ids;
end $$;

create or replace function public.admin_create_club_group(
  p_name            text,
  p_member_club_ids uuid[],
  p_max_teams       integer default null,
  p_max_players     integer default null,
  p_max_staff       integer default null
)
  returns uuid
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_ids uuid[];
  v_id  uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;

  v_ids := private.assert_valid_group_members(null, p_member_club_ids);

  insert into public.clubs (name, is_group)
  values (trim(p_name), true)
  returning id into v_id;

  insert into public.club_roles (club_id, name, access_level, is_system)
  values (v_id, 'Propriétaire', 'full', true);
  insert into public.club_roles (club_id, name, access_level, is_system)
  values (v_id, 'Coach', 'team', true);

  insert into public.club_licenses
    (club_id, status, auto_renew, max_teams, max_players, max_staff, created_by, notes)
  values
    (v_id, 'active', true, p_max_teams, p_max_players, p_max_staff, auth.uid(),
     'Regroupement: quotas actifs, pas de facturation automatique.');

  insert into public.club_group_members (group_club_id, member_club_id)
  select v_id, x from unnest(v_ids) as x;

  insert into public.license_events (club_id, actor, event_type, payload)
  values (v_id, auth.uid(), 'group_created', jsonb_build_object(
    'member_club_ids', v_ids,
    'max_teams', p_max_teams,
    'max_players', p_max_players,
    'max_staff', p_max_staff
  ));

  return v_id;
end $$;

create or replace function public.admin_update_club_group(
  p_group_club_id   uuid,
  p_name            text,
  p_member_club_ids uuid[],
  p_max_teams       integer default null,
  p_max_players     integer default null,
  p_max_staff       integer default null
)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_ids uuid[];
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;

  if not exists (select 1 from public.clubs where id = p_group_club_id and is_group = true) then
    raise exception 'group_not_found';
  end if;

  v_ids := private.assert_valid_group_members(p_group_club_id, p_member_club_ids);

  update public.clubs
     set name = trim(p_name), updated_at = now()
   where id = p_group_club_id and is_group = true;

  update public.club_licenses
     set max_teams = p_max_teams,
         max_players = p_max_players,
         max_staff = p_max_staff,
         updated_at = now()
   where club_id = p_group_club_id;

  delete from public.club_group_members
   where group_club_id = p_group_club_id and not (member_club_id = any(v_ids));
  insert into public.club_group_members (group_club_id, member_club_id)
  select p_group_club_id, x from unnest(v_ids) as x
  on conflict do nothing;

  insert into public.license_events (club_id, actor, event_type, payload)
  values (p_group_club_id, auth.uid(), 'group_updated', jsonb_build_object(
    'member_club_ids', v_ids,
    'max_teams', p_max_teams,
    'max_players', p_max_players,
    'max_staff', p_max_staff
  ));
end $$;

create or replace function public.admin_archive_club_group(p_group_club_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.clubs where id = p_group_club_id and is_group = true) then
    raise exception 'group_not_found';
  end if;
  perform public.admin_archive_club(p_group_club_id);
end $$;

create or replace function public.admin_delete_club_group(
  p_group_club_id uuid,
  p_confirm_name  text
)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.clubs where id = p_group_club_id and is_group = true) then
    raise exception 'group_not_found';
  end if;
  perform public.admin_delete_club(p_group_club_id, p_confirm_name);
end $$;

-- Keep the admin overview aware of club-vs-regroupement so the UI can present
-- them in separate sections while reusing the same counters and quota columns.
drop function if exists public.admin_clubs_overview();
create or replace function public.admin_clubs_overview()
  returns table (
    club_id         uuid,
    name            text,
    created_at      timestamptz,
    archived_at     timestamptz,
    is_group        boolean,
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
    c.is_group,
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

revoke all on function public.admin_create_club_group(text, uuid[], integer, integer, integer) from public;
revoke all on function public.admin_update_club_group(uuid, text, uuid[], integer, integer, integer) from public;
revoke all on function public.admin_archive_club_group(uuid) from public;
revoke all on function public.admin_delete_club_group(uuid, text) from public;
revoke all on function public.admin_clubs_overview() from public;
grant execute on function public.admin_create_club_group(text, uuid[], integer, integer, integer) to authenticated, service_role;
grant execute on function public.admin_update_club_group(uuid, text, uuid[], integer, integer, integer) to authenticated, service_role;
grant execute on function public.admin_archive_club_group(uuid) to authenticated, service_role;
grant execute on function public.admin_delete_club_group(uuid, text) to authenticated, service_role;
grant execute on function public.admin_clubs_overview() to authenticated, service_role;
