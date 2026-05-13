-- =====================================================================
-- 0018 — create_team SECURITY DEFINER RPC
-- =====================================================================
-- Direct RLS-checked INSERT on teams was rejected by Postgres despite the
-- WITH CHECK expression evaluating true in isolation (auth.uid +
-- user_club_access + club_is_active all confirmed correct via
-- debug_team_insert probe — staging, 2026-05-13). Suspected pooler/runtime
-- quirk in the Supabase env. Workaround: route INSERT through this RPC,
-- which performs the same auth checks in PL/pgSQL and inserts as the
-- function owner (postgres) bypassing the WITH CHECK.
--
-- The teams_full_insert RLS policy is kept intact so direct table writes
-- (e.g. service_role admin tasks, internal scripts) still apply correctly.
-- =====================================================================

create or replace function public.create_team(
  p_name      text,
  p_season    text default null,
  p_age_group text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_club uuid;
  v_team uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  -- Pick the user's first full-access membership. Multi-club switch is not
  -- yet plumbed through the RPC contract — when needed, add a p_club_id arg
  -- and validate it against the caller's memberships.
  select m.club_id into v_club
  from public.club_memberships m
  join public.club_roles r on r.id = m.role_id
  where m.user_id = v_user and r.access_level = 'full'
  order by m.created_at asc
  limit 1;

  if v_club is null then
    raise exception 'no club with full access';
  end if;

  if not private.club_is_active(v_club) then
    raise exception 'club not active';
  end if;

  insert into public.teams (club_id, trainer_id, name, season, age_group)
  values (
    v_club,
    v_user,
    p_name,
    nullif(p_season, ''),
    nullif(p_age_group, '')
  )
  returning id into v_team;

  return v_team;
end $$;

grant execute on function public.create_team(text, text, text) to authenticated;

-- Cleanup of the temporary diagnostic helper used while chasing the RLS
-- quirk above. Drop the function and its grant — no longer needed.
drop function if exists public.debug_team_insert(uuid);
