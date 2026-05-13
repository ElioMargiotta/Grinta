alter table public.teams
  add column if not exists photo_url text;

alter table public.teams
  add constraint teams_photo_url_length check (photo_url is null or length(photo_url) <= 500);

create or replace function public.update_team(
  p_team_id uuid,
  p_name text,
  p_season text default null,
  p_age_group text default null,
  p_description text default null,
  p_photo_url text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_club uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select t.club_id into v_club
  from public.teams t
  where t.id = p_team_id;

  if v_club is null then
    raise exception 'team not found';
  end if;

  if private.user_team_access(p_team_id) not in ('full', 'extended', 'team') then
    raise exception 'not allowed';
  end if;

  if not private.club_is_active(v_club) then
    raise exception 'club not active';
  end if;

  update public.teams
     set name = nullif(trim(p_name), ''),
         season = nullif(trim(coalesce(p_season, '')), ''),
         age_group = nullif(trim(coalesce(p_age_group, '')), ''),
         description = nullif(trim(coalesce(p_description, '')), ''),
         photo_url = nullif(trim(coalesce(p_photo_url, '')), '')
   where id = p_team_id;
end $$;

grant execute on function public.update_team(uuid, text, text, text, text, text) to authenticated;
