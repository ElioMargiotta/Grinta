-- Platform-level super-admins (Grinta operators), distinct from per-club roles.
-- They provision clubs, manage licences and access a cross-tenant dashboard.
-- This is the foundation for the licence-based (quote/devis) commercial model
-- that replaces the self-serve Stripe subscription.

create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- SECURITY DEFINER so it reads platform_admins regardless of the caller's RLS
-- context. Used inside RLS policies and RPCs across the whole app — keep it
-- cheap and side-effect free.
create or replace function public.is_platform_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated, service_role;

-- Only platform admins can see / manage the admin roster.
create policy platform_admins_admin_all on public.platform_admins
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, delete on table public.platform_admins to authenticated, service_role;

-- Seed the founding operator (Elio) by email. Idempotent: no-op if the auth
-- user does not exist yet (e.g. fresh DB) or is already an admin.
do $$
declare
  v_uid uuid;
begin
  select id into v_uid
    from auth.users
   where lower(email) = lower('elio.margiotta@icloud.com')
   limit 1;

  if v_uid is not null then
    insert into public.platform_admins (user_id, note)
    values (v_uid, 'Founder / platform operator')
    on conflict (user_id) do nothing;
  end if;
end $$;
