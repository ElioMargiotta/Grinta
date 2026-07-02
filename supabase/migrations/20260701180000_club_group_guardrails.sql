-- Liens forts club ↔ regroupement.
--
-- 1. Un club membre ne peut plus être archivé/supprimé tant qu'il appartient à
--    un regroupement. Il faut d'abord le retirer du regroupement.
-- 2. Un regroupement qui possède déjà des équipes/joueurs/staff demande une
--    confirmation explicite supplémentaire avant suppression.

create or replace function private.club_is_group_member(p_club_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists (
    select 1 from public.club_group_members where member_club_id = p_club_id
  );
$$;

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
  if private.club_is_group_member(p_club_id) then
    raise exception 'club_is_group_member';
  end if;

  update public.clubs
     set archived_at = now(), updated_at = now()
   where id = p_club_id and archived_at is null;
  if not found then
    raise exception 'club_not_found_or_archived';
  end if;

  update public.club_licenses set status = 'suspended' where club_id = p_club_id;

  insert into public.license_events (club_id, actor, event_type, payload)
  values (p_club_id, auth.uid(), 'archived', '{}'::jsonb);
end $$;

create or replace function public.admin_delete_club(
  p_club_id       uuid,
  p_confirm_name  text
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
  if private.club_is_group_member(p_club_id) then
    raise exception 'club_is_group_member';
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

create or replace function public.admin_delete_club_group(
  p_group_club_id      uuid,
  p_confirm_name       text,
  p_allow_data_delete  boolean default false
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
  if not p_allow_data_delete and (
    public.club_team_count(p_group_club_id) > 0
    or public.club_player_count(p_group_club_id) > 0
    or public.club_staff_count(p_group_club_id) > 0
  ) then
    raise exception 'group_not_empty';
  end if;

  perform public.admin_delete_club(p_group_club_id, p_confirm_name);
end $$;

revoke all on function public.admin_archive_club(uuid) from public;
revoke all on function public.admin_delete_club(uuid, text) from public;
revoke all on function public.admin_delete_club_group(uuid, text, boolean) from public;
grant execute on function public.admin_archive_club(uuid) to authenticated, service_role;
grant execute on function public.admin_delete_club(uuid, text) to authenticated, service_role;
grant execute on function public.admin_delete_club_group(uuid, text, boolean) to authenticated, service_role;
