-- Regroupement (côté admin, purement informatif) : un club Grinta reste UN club
-- (une licence, un contingent, aucune donnée partagée), mais l'admin plateforme
-- peut noter la liste des clubs qui le composent — pour s'y retrouver. Ce sont
-- de simples noms libres (souvent piochés dans l'annuaire ASF). Aucun effet
-- fonctionnel : ni RLS, ni facturation, ni accès.

alter table public.clubs
  add column if not exists member_clubs text[] not null default '{}';

alter table public.clubs
  drop constraint if exists clubs_member_clubs_max;
alter table public.clubs
  add constraint clubs_member_clubs_max
  check (array_length(member_clubs, 1) is null or array_length(member_clubs, 1) <= 12);

-- Écriture réservée aux platform admins (les clubs sont sinon protégés par RLS
-- membre uniquement). Self-guarded comme les autres RPC admin.
create or replace function public.admin_set_club_member_clubs(
  p_club_id     uuid,
  p_member_clubs text[]
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

  update public.clubs
     set member_clubs = coalesce(p_member_clubs, '{}'),
         updated_at = now()
   where id = p_club_id;
  if not found then
    raise exception 'club_not_found';
  end if;
end $$;

revoke all on function public.admin_set_club_member_clubs(uuid, text[]) from public;
grant execute on function public.admin_set_club_member_clubs(uuid, text[]) to authenticated, service_role;
