-- Licence enforcement + admin provisioning RPCs + cross-tenant read access.
--
-- 1. Redefine private.club_is_active() to derive from the licence state. This
--    is the central write gate used by RLS WITH CHECK policies and SECURITY
--    DEFINER RPCs across the app, so a single change makes every write path
--    licence-aware: writes are allowed only when the licence is 'active'
--    (blocked during 'grace' read-only and 'locked').
-- 2. Hard quota enforcement via BEFORE INSERT triggers on teams / players /
--    club_memberships (catches every insert path, including CSV import).
-- 3. Platform-admin RPCs to provision clubs and manage licences + admins.
-- 4. Cross-tenant SELECT policies so platform admins can read the dashboard.

-- ---------------------------------------------------------------------------
-- 1. Central write gate now follows the licence (was: subscription_status)
-- ---------------------------------------------------------------------------
create or replace function private.club_is_active(p_club_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select public.club_license_state(p_club_id) = 'active';
$$;

-- ---------------------------------------------------------------------------
-- 2. Hard quota triggers
-- ---------------------------------------------------------------------------
create or replace function public.enforce_team_quota()
  returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_max int;
begin
  if new.archived_at is null then
    select max_teams into v_max from public.club_licenses where club_id = new.club_id;
    if v_max is not null and public.club_team_count(new.club_id) >= v_max then
      raise exception 'team_quota_reached' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create trigger teams_enforce_quota
  before insert on public.teams
  for each row execute function public.enforce_team_quota();

create or replace function public.enforce_player_quota()
  returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_max int;
begin
  select max_players into v_max from public.club_licenses where club_id = new.club_id;
  if v_max is not null and public.club_player_count(new.club_id) >= v_max then
    raise exception 'player_quota_reached' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger players_enforce_quota
  before insert on public.players
  for each row execute function public.enforce_player_quota();

create or replace function public.enforce_staff_quota()
  returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_max int;
begin
  select max_staff into v_max from public.club_licenses where club_id = new.club_id;
  if v_max is not null and public.club_staff_count(new.club_id) >= v_max then
    raise exception 'staff_quota_reached' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger memberships_enforce_quota
  before insert on public.club_memberships
  for each row execute function public.enforce_staff_quota();

-- ---------------------------------------------------------------------------
-- 3a. create_invitation: let platform admins invite into any club (they are
--     not members), and surface the staff quota early for nicer UX.
-- ---------------------------------------------------------------------------
create or replace function public.create_invitation(
  p_club_id   uuid,
  p_email     text,
  p_role_id   uuid,
  p_team_ids  uuid[] default '{}'::uuid[],
  p_ttl_hours integer default 168
)
  returns text
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_token   text;
  v_hash    text;
  v_role    record;
  v_team_id uuid;
  v_max     int;
  v_admin   boolean := public.is_platform_admin();
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if not v_admin then
    if private.user_club_access(p_club_id) not in ('full'::public.access_level, 'extended'::public.access_level) then
      raise exception 'forbidden';
    end if;
    if not private.club_is_active(p_club_id) then
      raise exception 'club_inactive';
    end if;
  end if;

  select id, access_level into v_role
    from public.club_roles
   where id = p_role_id and club_id = p_club_id;
  if v_role is null then
    raise exception 'role_not_in_club';
  end if;

  if v_role.access_level in ('team', 'team_readonly')
     and (p_team_ids is null or array_length(p_team_ids, 1) is null) then
    raise exception 'team_role_requires_team';
  end if;

  -- Staff quota: count current staff against the licence cap. The hard cap is
  -- also enforced on club_memberships insert (accept time); this is best-effort
  -- to fail fast at invite time.
  select max_staff into v_max from public.club_licenses where club_id = p_club_id;
  if v_max is not null and public.club_staff_count(p_club_id) >= v_max then
    raise exception 'staff_quota_reached';
  end if;

  v_team_id := (case
                  when p_team_ids is not null and array_length(p_team_ids, 1) >= 1
                  then p_team_ids[1]
                  else null
                end);

  v_token := replace(replace(replace(
              encode(extensions.gen_random_bytes(24), 'base64'),
              '+', '-'), '/', '_'), '=', '');
  v_hash  := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');

  update public.club_invitations
     set status = 'revoked'
   where club_id = p_club_id
     and lower(email) = lower(p_email)
     and status = 'pending';

  insert into public.club_invitations
    (club_id, kind, email, token_hash, role_id, team_id, invited_by, expires_at)
  values
    (p_club_id, 'staff', lower(p_email), v_hash, p_role_id, v_team_id, auth.uid(),
     now() + (p_ttl_hours || ' hours')::interval);

  return v_token;
end $$;

revoke all on function public.create_invitation(uuid, text, uuid, uuid[], integer) from public;
grant execute on function public.create_invitation(uuid, text, uuid, uuid[], integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3b. Admin RPCs (all guarded by is_platform_admin)
-- ---------------------------------------------------------------------------

-- Provision a club + its licence + system roles. Returns the new club id; the
-- caller then issues an owner invitation (create_invitation) to p_owner_email.
create or replace function public.admin_create_club(
  p_name            text,
  p_owner_email     text default null,
  p_max_teams       integer default null,
  p_max_players     integer default null,
  p_max_staff       integer default null,
  p_ends_at         timestamptz default null,
  p_auto_renew      boolean default true,
  p_quote_reference text default null,
  p_notes           text default null
)
  returns uuid
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_club_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;

  insert into public.clubs (name) values (trim(p_name)) returning id into v_club_id;

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
            'max_teams', p_max_teams,
            'max_players', p_max_players,
            'max_staff', p_max_staff,
            'ends_at', p_ends_at,
            'auto_renew', p_auto_renew,
            'quote_reference', p_quote_reference));

  return v_club_id;
end $$;

create or replace function public.admin_update_license(
  p_club_id         uuid,
  p_max_teams       integer,
  p_max_players     integer,
  p_max_staff       integer,
  p_status          public.license_status,
  p_auto_renew      boolean,
  p_ends_at         timestamptz,
  p_quote_reference text,
  p_notes           text
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

  update public.club_licenses
     set max_teams = p_max_teams,
         max_players = p_max_players,
         max_staff = p_max_staff,
         status = p_status,
         auto_renew = p_auto_renew,
         ends_at = p_ends_at,
         quote_reference = p_quote_reference,
         notes = p_notes
   where club_id = p_club_id;

  if not found then
    raise exception 'license_not_found';
  end if;

  insert into public.license_events (club_id, actor, event_type, payload)
  values (p_club_id, auth.uid(), 'updated', jsonb_build_object(
            'max_teams', p_max_teams, 'max_players', p_max_players,
            'max_staff', p_max_staff, 'status', p_status,
            'auto_renew', p_auto_renew, 'ends_at', p_ends_at,
            'quote_reference', p_quote_reference));
end $$;

create or replace function public.admin_set_license_status(
  p_club_id uuid,
  p_status  public.license_status
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

  update public.club_licenses set status = p_status where club_id = p_club_id;
  if not found then
    raise exception 'license_not_found';
  end if;

  insert into public.license_events (club_id, actor, event_type, payload)
  values (p_club_id, auth.uid(),
          case when p_status = 'active' then 'reactivated'
               when p_status = 'suspended' then 'suspended'
               else 'status_changed' end,
          jsonb_build_object('status', p_status));
end $$;

create or replace function public.admin_add_platform_admin(p_email text)
  returns uuid
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare v_uid uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(p_email) limit 1;
  if v_uid is null then
    raise exception 'user_not_found';
  end if;

  insert into public.platform_admins (user_id, created_by)
  values (v_uid, auth.uid())
  on conflict (user_id) do nothing;

  return v_uid;
end $$;

create or replace function public.admin_remove_platform_admin(p_user_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_remove_self';
  end if;

  delete from public.platform_admins where user_id = p_user_id;
end $$;

revoke all on function public.admin_create_club(text, text, integer, integer, integer, timestamptz, boolean, text, text) from public;
revoke all on function public.admin_update_license(uuid, integer, integer, integer, public.license_status, boolean, timestamptz, text, text) from public;
revoke all on function public.admin_set_license_status(uuid, public.license_status) from public;
revoke all on function public.admin_add_platform_admin(text) from public;
revoke all on function public.admin_remove_platform_admin(uuid) from public;
grant execute on function public.admin_create_club(text, text, integer, integer, integer, timestamptz, boolean, text, text) to authenticated, service_role;
grant execute on function public.admin_update_license(uuid, integer, integer, integer, public.license_status, boolean, timestamptz, text, text) to authenticated, service_role;
grant execute on function public.admin_set_license_status(uuid, public.license_status) to authenticated, service_role;
grant execute on function public.admin_add_platform_admin(text) to authenticated, service_role;
grant execute on function public.admin_remove_platform_admin(uuid) to authenticated, service_role;

-- One-call overview powering the admin dashboard + clubs list. Self-guarded:
-- returns nothing for non-admins.
create or replace function public.admin_clubs_overview()
  returns table (
    club_id         uuid,
    name            text,
    created_at      timestamptz,
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

-- ---------------------------------------------------------------------------
-- 4. Cross-tenant SELECT for platform admins (additive: OR-combined with the
--    existing tenant policies). Lets the admin dashboard read every club.
-- ---------------------------------------------------------------------------
create policy clubs_admin_read on public.clubs
  for select to authenticated using (public.is_platform_admin());
create policy club_memberships_admin_read on public.club_memberships
  for select to authenticated using (public.is_platform_admin());
create policy club_roles_admin_read on public.club_roles
  for select to authenticated using (public.is_platform_admin());
create policy teams_admin_read on public.teams
  for select to authenticated using (public.is_platform_admin());
create policy players_admin_read on public.players
  for select to authenticated using (public.is_platform_admin());
create policy profiles_admin_read on public.profiles
  for select to authenticated using (public.is_platform_admin());
