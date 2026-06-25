-- Edit an existing club member's role and team assignments in one atomic call.
-- Until now team assignment was only set at invitation/accept time; this lets a
-- club manager re-assign a coach to more teams (e.g. add U16 to someone already
-- coaching U15) or change their role, without re-inviting.
--
-- Mirrors the create_invitation/accept_invitation rules:
--   * team / team_readonly roles require >= 1 team; the team set is replaced with
--     exactly p_team_ids.
--   * full / extended roles are club-wide and carry no team rows (cleared).
-- SECURITY DEFINER but self-guarded: caller must be a 'full' manager of the club.

create or replace function public.update_membership_assignment(
  p_membership_id uuid,
  p_role_id       uuid,
  p_team_ids      uuid[] default '{}'::uuid[]
)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_club_id uuid;
  v_role    record;
  v_team    uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select club_id into v_club_id
    from public.club_memberships
   where id = p_membership_id;
  if v_club_id is null then
    raise exception 'membership_not_found';
  end if;

  -- Only a full-access manager of this club may edit memberships.
  if private.user_club_access(v_club_id) <> 'full'::public.access_level then
    raise exception 'forbidden';
  end if;

  -- Target role must belong to the same club.
  select id, access_level into v_role
    from public.club_roles
   where id = p_role_id and club_id = v_club_id;
  if v_role.id is null then
    raise exception 'role_not_in_club';
  end if;

  if v_role.access_level in ('team', 'team_readonly') then
    if p_team_ids is null or array_length(p_team_ids, 1) is null then
      raise exception 'team_role_requires_team';
    end if;
    -- Every provided team must belong to this club.
    if exists (
      select 1
        from unnest(p_team_ids) as tid
        left join public.teams t on t.id = tid and t.club_id = v_club_id
       where t.id is null
    ) then
      raise exception 'team_not_in_club';
    end if;
  end if;

  update public.club_memberships
     set role_id = p_role_id
   where id = p_membership_id;

  if v_role.access_level in ('full', 'extended') then
    -- Club-wide role: no team scoping.
    delete from public.team_memberships where membership_id = p_membership_id;
  else
    -- Replace the team set with exactly p_team_ids.
    delete from public.team_memberships
     where membership_id = p_membership_id
       and team_id <> all (p_team_ids);
    foreach v_team in array p_team_ids loop
      insert into public.team_memberships (team_id, membership_id)
      values (v_team, p_membership_id)
      on conflict do nothing;
    end loop;
  end if;
end $$;

revoke all on function public.update_membership_assignment(uuid, uuid, uuid[]) from public;
grant execute on function public.update_membership_assignment(uuid, uuid, uuid[]) to authenticated, service_role;
