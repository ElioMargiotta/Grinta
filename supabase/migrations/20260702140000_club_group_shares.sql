-- Chantier C — Partage opt-in, contrôlé par le CLUB MEMBRE (rivalité-aware).
--
-- Contrainte clé (ex. Bôle-Colombier) : les clubs d'un regroupement junior restent
-- adversaires en actifs. Rien ne se partage automatiquement : composition et
-- planification ne sont JAMAIS exposées. Seul le club membre décide, par type de
-- donnée, ce qu'il dévoile au regroupement.
--
-- v1 : un seul type câblé, `suivi_joueur` (mesures physiques + évaluations), pour
-- le flux « 1re équipe du club ↔ juniors du regroupement ». Le partage est
-- SYMÉTRIQUE dans la paire (groupe, club membre) : si activé, les membres du groupe
-- voient le suivi du club, et les membres du club voient le suivi du groupe.
-- `objectifs` est réservé (table dédiée à venir).

create table if not exists public.club_group_shares (
  group_club_id  uuid not null,
  member_club_id uuid not null,
  share_type     text not null check (share_type in ('suivi_joueur', 'objectifs')),
  created_by     uuid,
  created_at     timestamptz not null default now(),
  primary key (group_club_id, member_club_id, share_type),
  foreign key (group_club_id, member_club_id)
    references public.club_group_members (group_club_id, member_club_id) on delete cascade
);
create index if not exists club_group_shares_member_idx
  on public.club_group_shares (member_club_id);

alter table public.club_group_shares enable row level security;

-- Lecture des réglages : membres du groupe OU du club concerné, ou admin.
drop policy if exists club_group_shares_read on public.club_group_shares;
create policy club_group_shares_read on public.club_group_shares
  for select using (
    public.is_platform_admin()
    or private.user_club_access(group_club_id) is not null
    or private.user_club_access(member_club_id) is not null
  );

-- Peut-on lire une donnée du club `p_owner_club_id` via un partage de regroupement ?
create or replace function private.can_read_via_group_share(
  p_owner_club_id uuid,
  p_share_type    text
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists (
    select 1
    from public.club_group_shares s
    where s.share_type = p_share_type
      and (
        (p_owner_club_id = s.member_club_id
          and private.user_club_access(s.group_club_id) is not null)
        or
        (p_owner_club_id = s.group_club_id
          and private.user_club_access(s.member_club_id) is not null)
      )
  );
$$;

-- Politiques de lecture ADDITIONNELLES (permissives → OR avec l'existant). L'accès
-- direct au club n'est pas modifié ; on n'ouvre que la lecture croisée du suivi.
drop policy if exists physical_measurements_read_group_share on public.physical_measurements;
create policy physical_measurements_read_group_share
  on public.physical_measurements for select
  using (private.can_read_via_group_share(club_id, 'suivi_joueur'));

drop policy if exists physical_metrics_read_group_share on public.physical_metrics;
create policy physical_metrics_read_group_share
  on public.physical_metrics for select
  using (private.can_read_via_group_share(club_id, 'suivi_joueur'));

drop policy if exists player_evaluations_read_group_share on public.player_evaluations;
create policy player_evaluations_read_group_share
  on public.player_evaluations for select
  using (private.can_read_via_group_share(club_id, 'suivi_joueur'));

-- Bascule du partage : réservée aux gestionnaires (full/extended) du CLUB MEMBRE.
create or replace function public.set_club_group_share(
  p_group_club_id  uuid,
  p_member_club_id uuid,
  p_share_type     text,
  p_enabled        boolean
)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_acc public.access_level;
begin
  if p_share_type not in ('suivi_joueur', 'objectifs') then
    raise exception 'invalid_share_type';
  end if;

  v_acc := private.user_club_access(p_member_club_id);
  if not public.is_platform_admin() and (v_acc is null or v_acc not in ('full', 'extended')) then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1 from public.club_group_members
     where group_club_id = p_group_club_id and member_club_id = p_member_club_id
  ) then
    raise exception 'not_a_group_member';
  end if;

  if p_enabled then
    insert into public.club_group_shares (group_club_id, member_club_id, share_type, created_by)
    values (p_group_club_id, p_member_club_id, p_share_type, auth.uid())
    on conflict do nothing;
  else
    delete from public.club_group_shares
     where group_club_id = p_group_club_id
       and member_club_id = p_member_club_id
       and share_type = p_share_type;
  end if;
end $$;

revoke all on function public.set_club_group_share(uuid, uuid, text, boolean) from public;
grant execute on function public.set_club_group_share(uuid, uuid, text, boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
