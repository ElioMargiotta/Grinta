-- Club directory: a read-only reference catalogue of official ASF/SFV clubs,
-- pre-seeded per regional association (ANF, AVF, …). It is NOT a tenant: rows
-- here carry no licence, members, teams or billing. When onboarding a real
-- club, a platform admin picks a directory entry and `admin_create_club` links
-- the new tenant back to it via `clubs.directory_id`.
--
-- Linked legal entities (e.g. Neuchâtel Xamax 1912 SA #7702 and Neuchâtel
-- Xamax FCS #7067) are stored as two distinct rows — they are two distinct
-- official ASF numbers — and clustered for display via `group_key`.
--
-- Visible to platform admins only.

-- ---------------------------------------------------------------------------
-- 1. Directory table
-- ---------------------------------------------------------------------------
create table if not exists public.club_directory (
  id          uuid primary key default gen_random_uuid(),
  asf_number  text not null unique,        -- official ASF/SFV club number
  name        text not null,
  association text not null,                -- regional association code, e.g. 'ANF'
  canton      text,                         -- e.g. 'NE'
  city        text,
  group_key   text,                         -- clusters linked entities (e.g. 'xamax')
  created_at  timestamptz not null default now()
);

create index if not exists club_directory_association_idx on public.club_directory (association);
create index if not exists club_directory_group_idx on public.club_directory (group_key);

alter table public.club_directory enable row level security;

-- Reference data is admin-only and seeded via migrations; no write policy.
create policy club_directory_admin_read on public.club_directory
  for select to authenticated using (public.is_platform_admin());

grant select on table public.club_directory to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Link a tenant club back to its directory entry
-- ---------------------------------------------------------------------------
alter table public.clubs
  add column if not exists directory_id uuid references public.club_directory (id);
create index if not exists clubs_directory_idx on public.clubs (directory_id);

-- ---------------------------------------------------------------------------
-- 3. admin_create_club: accept an optional directory entry. When provided, the
--    new club is linked to it and (if no explicit name is given) inherits its
--    name. Re-created with the extra trailing parameter.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_create_club(
  text, text, integer, integer, integer, timestamptz, boolean, text, text);

create or replace function public.admin_create_club(
  p_name            text,
  p_owner_email     text default null,
  p_max_teams       integer default null,
  p_max_players     integer default null,
  p_max_staff       integer default null,
  p_ends_at         timestamptz default null,
  p_auto_renew      boolean default true,
  p_quote_reference text default null,
  p_notes           text default null,
  p_directory_id    uuid default null
)
  returns uuid
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_club_id uuid;
  v_name    text := nullif(trim(coalesce(p_name, '')), '');
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  if p_directory_id is not null then
    if not exists (select 1 from public.club_directory where id = p_directory_id) then
      raise exception 'directory_not_found';
    end if;
    if v_name is null then
      select name into v_name from public.club_directory where id = p_directory_id;
    end if;
  end if;

  if v_name is null then
    raise exception 'name_required';
  end if;

  insert into public.clubs (name, directory_id)
  values (v_name, p_directory_id)
  returning id into v_club_id;

  insert into public.club_roles (club_id, name, access_level, is_system)
  values (v_club_id, 'Propriétaire', 'full', true);
  insert into public.club_roles (club_id, name, access_level, is_system)
  values (v_club_id, 'Coach', 'team', true);

  insert into public.club_licenses
    (club_id, status, auto_renew, max_teams, max_players, max_staff,
     ends_at, quote_reference, notes, created_by)
  values
    (v_club_id, 'active', p_auto_renew, p_max_teams, p_max_players, p_max_staff,
     p_ends_at, p_quote_reference, p_notes, auth.uid());

  insert into public.license_events (club_id, actor, event_type, payload)
  values (v_club_id, auth.uid(), 'created', jsonb_build_object(
            'owner_email', lower(coalesce(p_owner_email, '')),
            'directory_id', p_directory_id,
            'max_teams', p_max_teams,
            'max_players', p_max_players,
            'max_staff', p_max_staff,
            'ends_at', p_ends_at,
            'auto_renew', p_auto_renew,
            'quote_reference', p_quote_reference));

  return v_club_id;
end $$;

revoke all on function public.admin_create_club(
  text, text, integer, integer, integer, timestamptz, boolean, text, text, uuid) from public;
grant execute on function public.admin_create_club(
  text, text, integer, integer, integer, timestamptz, boolean, text, text, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Seed — Association neuchâteloise de football (ANF). Canton NE.
--    The association entity itself (#7000) is included as a directory row too.
--    Idempotent on asf_number.
-- ---------------------------------------------------------------------------
insert into public.club_directory (asf_number, name, association, canton, group_key) values
  ('7000', 'Association neuchâteloise de football', 'ANF', 'NE', null),
  ('7028', 'ASI Audax-Friul',                'ANF', 'NE', null),
  ('7034', 'FC Béroche-Gorgier',             'ANF', 'NE', null),
  ('7002', 'FC Bevaix',                       'ANF', 'NE', null),
  ('7838', 'FC Les Bois',                     'ANF', 'NE', null),
  ('7045', 'FC Bôle',                         'ANF', 'NE', null),
  ('7062', 'FC Bosna Neuchâtel',              'ANF', 'NE', null),
  ('7003', 'FC Boudry',                       'ANF', 'NE', null),
  ('7013', 'FC Les Brenets',                  'ANF', 'NE', null),
  ('7029', 'FC Centre Portugais',             'ANF', 'NE', null),
  ('7005', 'FC La Chaux-de-Fonds',            'ANF', 'NE', null),
  ('7047', 'FC Coffrane',                     'ANF', 'NE', null),
  ('7011', 'FC Colombier',                    'ANF', 'NE', null),
  ('7016', 'FC Corcelles Cormondrèche',       'ANF', 'NE', null),
  ('7053', 'FC Cornaux',                      'ANF', 'NE', null),
  ('7012', 'FC Cortaillod',                   'ANF', 'NE', null),
  ('7074', 'Cressier Sport 2019',             'ANF', 'NE', null),
  ('7010', 'FC Deportivo',                    'ANF', 'NE', null),
  ('7836', 'FC Erguël',                       'ANF', 'NE', null),
  ('7031', 'FC Espagnol Neuchâtel',           'ANF', 'NE', null),
  ('7006', 'FC Etoile-Sporting',              'ANF', 'NE', null),
  ('7073', 'FC Le Communal Sport Le Locle',   'ANF', 'NE', null),
  ('7007', 'FC Floria',                       'ANF', 'NE', null),
  ('7023', 'FC Hauterive',                    'ANF', 'NE', null),
  ('7046', 'FC Helvetia Neuchâtel',           'ANF', 'NE', null),
  ('7060', 'FC Kosova Neuchâtel',             'ANF', 'NE', null),
  ('7024', 'FC Le Landeron',                  'ANF', 'NE', null),
  ('7025', 'FC Le Locle',                     'ANF', 'NE', null),
  ('7044', 'FC Lignières',                    'ANF', 'NE', null),
  ('7058', 'FC Lusitanos',                    'ANF', 'NE', null),
  ('7043', 'FC Marin-Sports',                 'ANF', 'NE', null),
  ('7027', 'FC Môtiers',                      'ANF', 'NE', null),
  ('7077', 'NE Galaxy',                       'ANF', 'NE', null),
  ('7068', 'Neuchâtel City FC',               'ANF', 'NE', null),
  ('7702', 'Neuchâtel Xamax 1912 SA',         'ANF', 'NE', 'xamax'),
  ('7008', 'FC Le Parc',                      'ANF', 'NE', null),
  ('7033', 'FC Peseux Comète',                'ANF', 'NE', null),
  ('7050', 'FC Les Ponts-de-Martel',          'ANF', 'NE', null),
  ('7038', 'FC La Sagne',                     'ANF', 'NE', null),
  ('7035', 'FC Saint-Blaise',                 'ANF', 'NE', null),
  ('7009', 'FC Superga',                      'ANF', 'NE', null),
  ('7026', 'FC Ticino',                       'ANF', 'NE', null),
  ('7066', 'FC Unine',                        'ANF', 'NE', null),
  ('7075', 'FC United Milvignes',             'ANF', 'NE', null),
  ('7069', 'FC Val-de-Ruz',                   'ANF', 'NE', null),
  ('7078', 'FC Val-de-Travers',               'ANF', 'NE', null),
  ('7839', 'AS Vallée',                       'ANF', 'NE', null),
  ('7835', 'US Villeret',                     'ANF', 'NE', null),
  ('7067', 'Neuchâtel Xamax FCS',             'ANF', 'NE', 'xamax')
on conflict (asf_number) do nothing;
