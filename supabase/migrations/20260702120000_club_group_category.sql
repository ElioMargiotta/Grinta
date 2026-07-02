-- Chantier A — 4 catégories de regroupement (art. 10 ASF) + sous-catégories.
--
-- Un regroupement (club-contexte `is_group=true`) porte désormais une CATÉGORIE :
--   hommes_actifs | femmes | seniors | juniors
-- avec une sous-catégorie pour seniors (s30/s40/s50) et juniors (jg/jf).
--
-- Règles ASF encodées :
--  - hommes_actifs : max 2 clubs ; sinon max 6 (art. 6-9).
--  - un club ne peut être que dans UN regroupement PAR (catégorie, sous-catégorie)
--    (art. 8-9) ; mais peut appartenir à un regroupement de chaque catégorie (art. 10).

-- 1. Colonnes catégorie / sous-catégorie sur le club-contexte.

alter table public.clubs
  add column if not exists group_category text,
  add column if not exists group_subcategory text;

-- Backfill des regroupements existants (créés avant la catégorie) : juniors par
-- défaut (cas le plus fréquent), sous-catégorie laissée nulle.
update public.clubs
   set group_category = 'juniors'
 where is_group = true and group_category is null;

alter table public.clubs
  drop constraint if exists clubs_group_category_valid,
  add constraint clubs_group_category_valid
    check (group_category is null
      or group_category in ('hommes_actifs', 'femmes', 'seniors', 'juniors'));

alter table public.clubs
  drop constraint if exists clubs_group_subcategory_valid,
  add constraint clubs_group_subcategory_valid
    check (
      group_subcategory is null
      or (group_category = 'seniors' and group_subcategory in ('s30', 's40', 's50'))
      or (group_category = 'juniors' and group_subcategory in ('jg', 'jf'))
    );

-- Un club-contexte a toujours une catégorie ; un club tenant n'en a jamais.
alter table public.clubs
  drop constraint if exists clubs_group_category_matches_is_group,
  add constraint clubs_group_category_matches_is_group
    check (is_group = (group_category is not null));

create index if not exists clubs_group_category_idx
  on public.clubs (group_category, group_subcategory) where is_group = true;

-- 2. Validation des membres, désormais scopée par (catégorie, sous-catégorie).

drop function if exists private.assert_valid_group_members(uuid, uuid[]);

create or replace function private.assert_valid_group_members(
  p_group_club_id   uuid,
  p_member_club_ids uuid[],
  p_category        text,
  p_subcategory     text
)
  returns uuid[]
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $$
declare
  v_ids uuid[];
  v_max integer;
begin
  select array_agg(distinct x) into v_ids from unnest(p_member_club_ids) as x;
  v_max := case when p_category = 'hommes_actifs' then 2 else 6 end;
  if v_ids is null or array_length(v_ids, 1) < 2 or array_length(v_ids, 1) > v_max then
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
  -- Unicité par (catégorie, sous-catégorie) : art. 8-9 ASF.
  if exists (
    select 1
    from public.club_group_members m
    join public.clubs g on g.id = m.group_club_id
    where m.member_club_id = any(v_ids)
      and (p_group_club_id is null or m.group_club_id <> p_group_club_id)
      and g.group_category = p_category
      and g.group_subcategory is not distinct from p_subcategory
  ) then
    raise exception 'member_already_in_group';
  end if;
  return v_ids;
end $$;

-- 3. Trigger d'écriture directe : même règle par (catégorie, sous-catégorie).

create or replace function public.enforce_single_group_membership()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_cat text;
  v_sub text;
begin
  select group_category, group_subcategory into v_cat, v_sub
    from public.clubs where id = new.group_club_id;
  if exists (
    select 1
    from public.club_group_members m
    join public.clubs g on g.id = m.group_club_id
    where m.member_club_id = new.member_club_id
      and m.group_club_id <> new.group_club_id
      and g.group_category = v_cat
      and g.group_subcategory is not distinct from v_sub
  ) then
    raise exception 'member_already_in_group';
  end if;
  return new;
end $$;

-- 4. RPC create/update : catégorie + sous-catégorie.

drop function if exists public.admin_create_club_group(text, uuid[], integer, integer, integer);
create or replace function public.admin_create_club_group(
  p_name            text,
  p_member_club_ids uuid[],
  p_category        text,
  p_subcategory     text default null,
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
  if p_category is null or p_category not in ('hommes_actifs', 'femmes', 'seniors', 'juniors') then
    raise exception 'invalid_category';
  end if;
  if p_category in ('seniors', 'juniors') and p_subcategory is null then
    raise exception 'subcategory_required';
  end if;
  if p_category not in ('seniors', 'juniors') then
    p_subcategory := null;
  end if;

  v_ids := private.assert_valid_group_members(null, p_member_club_ids, p_category, p_subcategory);

  insert into public.clubs (name, is_group, group_category, group_subcategory)
  values (trim(p_name), true, p_category, p_subcategory)
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
    'category', p_category,
    'subcategory', p_subcategory,
    'max_teams', p_max_teams,
    'max_players', p_max_players,
    'max_staff', p_max_staff
  ));

  return v_id;
end $$;

drop function if exists public.admin_update_club_group(uuid, text, uuid[], integer, integer, integer);
create or replace function public.admin_update_club_group(
  p_group_club_id   uuid,
  p_name            text,
  p_member_club_ids uuid[],
  p_category        text,
  p_subcategory     text default null,
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
  if p_category is null or p_category not in ('hommes_actifs', 'femmes', 'seniors', 'juniors') then
    raise exception 'invalid_category';
  end if;
  if p_category in ('seniors', 'juniors') and p_subcategory is null then
    raise exception 'subcategory_required';
  end if;
  if p_category not in ('seniors', 'juniors') then
    p_subcategory := null;
  end if;

  v_ids := private.assert_valid_group_members(p_group_club_id, p_member_club_ids, p_category, p_subcategory);

  update public.clubs
     set name = trim(p_name),
         group_category = p_category,
         group_subcategory = p_subcategory,
         updated_at = now()
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
    'category', p_category,
    'subcategory', p_subcategory,
    'max_teams', p_max_teams,
    'max_players', p_max_players,
    'max_staff', p_max_staff
  ));
end $$;

-- 5. Aperçu admin : exposer la catégorie du regroupement.

drop function if exists public.admin_clubs_overview();
create or replace function public.admin_clubs_overview()
  returns table (
    club_id           uuid,
    name              text,
    created_at        timestamptz,
    archived_at       timestamptz,
    is_group          boolean,
    group_category    text,
    group_subcategory text,
    state             text,
    status            public.license_status,
    auto_renew        boolean,
    ends_at           timestamptz,
    quote_reference   text,
    teams             integer,
    players           integer,
    staff             integer,
    max_teams         integer,
    max_players       integer,
    max_staff         integer
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
    c.group_category,
    c.group_subcategory,
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

revoke all on function public.admin_create_club_group(text, uuid[], text, text, integer, integer, integer) from public;
revoke all on function public.admin_update_club_group(uuid, text, uuid[], text, text, integer, integer, integer) from public;
revoke all on function public.admin_clubs_overview() from public;
grant execute on function public.admin_create_club_group(text, uuid[], text, text, integer, integer, integer) to authenticated, service_role;
grant execute on function public.admin_update_club_group(uuid, text, uuid[], text, text, integer, integer, integer) to authenticated, service_role;
grant execute on function public.admin_clubs_overview() to authenticated, service_role;
