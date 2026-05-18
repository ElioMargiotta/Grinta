-- =====================================================================
-- 0014 — Invitation acceptance RPC + token generation helpers
-- =====================================================================
-- Depends on 0012 + 0013.
--
-- The accept flow runs as SECURITY DEFINER because the invitee has no
-- membership yet — the RLS write policies on club_memberships would
-- otherwise block them.
-- =====================================================================

-- ---------------------------------------------------------------------
-- create_invitation(club_id, email, role_id, team_ids, ttl_hours)
-- Returns the generated token (urlsafe random text).
-- Caller must have user_club_access(club_id) = 'full'.
-- ---------------------------------------------------------------------
create or replace function create_invitation(
  p_club_id  uuid,
  p_email    text,
  p_role_id  uuid,
  p_team_ids uuid[] default '{}',
  p_ttl_hours int default 168            -- 7 days
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_role record;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  if user_club_access(p_club_id) <> 'full' then
    raise exception 'forbidden: only full-access members can invite';
  end if;

  -- Role must belong to the same club.
  select id, access_level into v_role
  from club_roles where id = p_role_id and club_id = p_club_id;

  if v_role is null then
    raise exception 'role does not belong to this club';
  end if;

  -- Team scope is required for team / team_readonly roles, forbidden otherwise.
  if v_role.access_level in ('team','team_readonly') and (p_team_ids is null or array_length(p_team_ids,1) is null) then
    raise exception 'team-scoped role requires at least one team';
  end if;

  if v_role.access_level in ('full','extended') and p_team_ids is not null and array_length(p_team_ids,1) is not null then
    raise exception 'club-wide role must not specify teams';
  end if;

  -- Generate a urlsafe random token (32 bytes → 43 base64url chars).
  v_token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+','-'), '/','_'), '=','');

  -- Revoke any pending invite for the same (club,email) — last write wins.
  delete from club_invitations
   where club_id = p_club_id and lower(email) = lower(p_email) and accepted_at is null;

  insert into club_invitations (club_id, email, role_id, team_ids, invited_by, token, expires_at)
  values (p_club_id, lower(p_email), p_role_id, coalesce(p_team_ids, '{}'::uuid[]),
          auth.uid(), v_token, now() + (p_ttl_hours || ' hours')::interval);

  return v_token;
end $$;

grant execute on function create_invitation(uuid, text, uuid, uuid[], int) to authenticated;

-- ---------------------------------------------------------------------
-- preview_invitation(token)
-- Public helper so the /invite/[token] page can show role + club before
-- the user accepts. Does NOT require auth. Returns a single-row table.
-- ---------------------------------------------------------------------
create or replace function preview_invitation(p_token text)
returns table (
  club_id       uuid,
  club_name     text,
  role_name     text,
  access_level  access_level,
  email         text,
  expires_at    timestamptz,
  already_accepted boolean,
  expired       boolean
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.name,
    r.name,
    r.access_level,
    i.email,
    i.expires_at,
    i.accepted_at is not null,
    i.expires_at < now()
  from club_invitations i
  join clubs c      on c.id = i.club_id
  join club_roles r on r.id = i.role_id
  where i.token = p_token
  limit 1
$$;

grant execute on function preview_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- accept_invitation(token)
-- Caller must be authenticated. Email of auth.users must match the
-- invitation's email (case-insensitive).
-- Creates the membership + team_memberships and marks invite accepted.
-- Returns the club_id the user now belongs to.
-- ---------------------------------------------------------------------
create or replace function accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_email text;
  v_inv  record;
  v_membership_id uuid;
  v_team uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  select email into v_user_email from auth.users where id = auth.uid();

  select * into v_inv from club_invitations where token = p_token for update;
  if v_inv is null then
    raise exception 'invitation not found';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'invitation already accepted';
  end if;

  if v_inv.expires_at < now() then
    raise exception 'invitation expired';
  end if;

  if lower(v_inv.email) <> lower(v_user_email) then
    raise exception 'this invitation was sent to %, not your account', v_inv.email;
  end if;

  -- Insert (or upsert) the club membership.
  insert into club_memberships (club_id, user_id, role_id)
  values (v_inv.club_id, auth.uid(), v_inv.role_id)
  on conflict (club_id, user_id) do update set role_id = excluded.role_id
  returning id into v_membership_id;

  -- Team assignments for team / team_readonly roles.
  if v_inv.team_ids is not null and array_length(v_inv.team_ids, 1) > 0 then
    foreach v_team in array v_inv.team_ids loop
      insert into team_memberships (team_id, membership_id)
      values (v_team, v_membership_id)
      on conflict do nothing;
    end loop;
  end if;

  update club_invitations set accepted_at = now() where id = v_inv.id;

  return v_inv.club_id;
end $$;

grant execute on function accept_invitation(text) to authenticated;
