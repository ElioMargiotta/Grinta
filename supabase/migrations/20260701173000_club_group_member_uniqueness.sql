-- Un club tenant ne peut appartenir qu'à un seul regroupement.
--
-- On applique la règle dans les RPC admin et via trigger pour les écritures
-- directes. Les doublons historiques éventuels restent visibles pour pouvoir
-- les nettoyer manuellement, mais aucune nouvelle insertion/update ne peut en
-- créer.

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
  if exists (
    select 1
    from public.club_group_members m
    where m.member_club_id = any(v_ids)
      and (p_group_club_id is null or m.group_club_id <> p_group_club_id)
  ) then
    raise exception 'member_already_in_group';
  end if;
  return v_ids;
end $$;

create or replace function public.enforce_single_group_membership()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if exists (
    select 1
    from public.club_group_members m
    where m.member_club_id = new.member_club_id
      and m.group_club_id <> new.group_club_id
  ) then
    raise exception 'member_already_in_group';
  end if;
  return new;
end $$;

drop trigger if exists club_group_members_single_membership on public.club_group_members;
create trigger club_group_members_single_membership
  before insert or update on public.club_group_members
  for each row execute function public.enforce_single_group_membership();
