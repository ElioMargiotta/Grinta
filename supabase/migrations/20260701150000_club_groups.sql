-- Phase 2a — Le REGROUPEMENT (groupement ASF) devient une entité, distincte du
-- club. Un regroupement relie 2 à 6 clubs tenants EXISTANTS. Créé côté admin
-- (structure) ; les membres, équipes partagées et invitations seront gérés côté
-- app en Phase 2b. Aucun partage de données ici.
--
-- NOTE 2026-07-01: cette migration a déjà été poussée en DEV. Elle est
-- conservée pour que l'historique Supabase local corresponde au remote. Le pivot
-- validé ensuite (Option B : regroupement = club-contexte) est dans
-- 20260701161000_club_groups_context.sql.

create table if not exists public.club_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  constraint club_groups_name_len check (length(name) between 2 and 120)
);

create table if not exists public.club_group_members (
  group_id uuid not null references public.club_groups(id) on delete cascade,
  club_id  uuid not null references public.clubs(id) on delete cascade,
  primary key (group_id, club_id)
);
create index if not exists club_group_members_club_idx on public.club_group_members (club_id);

create or replace function private.user_in_club_group(p_group_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists (
    select 1
    from public.club_group_members m
    join public.club_memberships cm on cm.club_id = m.club_id
    where m.group_id = p_group_id and cm.user_id = auth.uid()
  );
$$;

alter table public.club_groups enable row level security;
alter table public.club_group_members enable row level security;

create policy club_groups_read on public.club_groups
  for select using (public.is_platform_admin() or private.user_in_club_group(id));

create policy club_group_members_read on public.club_group_members
  for select using (public.is_platform_admin() or private.user_in_club_group(group_id));

create or replace function public.admin_create_club_group(
  p_name            text,
  p_member_club_ids uuid[]
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

  select array_agg(distinct x) into v_ids from unnest(p_member_club_ids) as x;
  if v_ids is null or array_length(v_ids, 1) < 2 or array_length(v_ids, 1) > 6 then
    raise exception 'invalid_member_count';
  end if;

  insert into public.club_groups (name) values (trim(p_name)) returning id into v_id;

  insert into public.club_group_members (group_id, club_id)
  select v_id, x from unnest(v_ids) as x;

  return v_id;
end $$;

create or replace function public.admin_update_club_group(
  p_group_id        uuid,
  p_name            text,
  p_member_club_ids uuid[]
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

  select array_agg(distinct x) into v_ids from unnest(p_member_club_ids) as x;
  if v_ids is null or array_length(v_ids, 1) < 2 or array_length(v_ids, 1) > 6 then
    raise exception 'invalid_member_count';
  end if;

  update public.club_groups set name = trim(p_name), updated_at = now()
   where id = p_group_id;
  if not found then
    raise exception 'group_not_found';
  end if;

  delete from public.club_group_members
   where group_id = p_group_id and not (club_id = any(v_ids));
  insert into public.club_group_members (group_id, club_id)
  select p_group_id, x from unnest(v_ids) as x
  on conflict do nothing;
end $$;

create or replace function public.admin_archive_club_group(p_group_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  update public.club_groups set archived_at = now(), updated_at = now()
   where id = p_group_id and archived_at is null;
  if not found then
    raise exception 'group_not_found_or_archived';
  end if;
end $$;

create or replace function public.admin_delete_club_group(p_group_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  delete from public.club_groups where id = p_group_id;
end $$;

revoke all on function public.admin_create_club_group(text, uuid[]) from public;
revoke all on function public.admin_update_club_group(uuid, text, uuid[]) from public;
revoke all on function public.admin_archive_club_group(uuid) from public;
revoke all on function public.admin_delete_club_group(uuid) from public;
grant execute on function public.admin_create_club_group(text, uuid[]) to authenticated, service_role;
grant execute on function public.admin_update_club_group(uuid, text, uuid[]) to authenticated, service_role;
grant execute on function public.admin_archive_club_group(uuid) to authenticated, service_role;
grant execute on function public.admin_delete_club_group(uuid) to authenticated, service_role;
