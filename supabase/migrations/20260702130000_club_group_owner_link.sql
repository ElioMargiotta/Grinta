-- Chantier B — Gouvernance : owner d'un club membre = owner du regroupement.
--
-- Règle Elio : « owner club = owner regroupement ». Les propriétaires (accès
-- `full`) de CHAQUE club membre obtiennent automatiquement l'accès propriétaire
-- au club-contexte du regroupement. Les coachs / directeurs techniques, eux,
-- restent invités séparément (club, regroupement, ou les deux) — inchangé.
--
-- Corrige aussi un manque : jusqu'ici un regroupement fraîchement créé n'avait
-- AUCUN membre → personne côté clubs ne pouvait y accéder. Désormais les owners
-- des clubs membres y ont accès dès l'ajout.
--
-- v1 : additif (propagation à l'ajout d'un club membre). Un owner ajouté PLUS TARD
-- à un club membre n'est pas rétro-propagé — à réévaluer si besoin.

create or replace function public.sync_group_owner_on_member_add()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_role_id uuid;
begin
  -- Rôle propriétaire (full, système) du club-contexte du regroupement.
  select id into v_role_id
    from public.club_roles
   where club_id = new.group_club_id
     and access_level = 'full'
     and is_system
   order by created_at asc
   limit 1;
  if v_role_id is null then
    return new;
  end if;

  insert into public.club_memberships (club_id, user_id, role_id)
  select new.group_club_id, cm.user_id, v_role_id
    from public.club_memberships cm
    join public.club_roles r on r.id = cm.role_id
   where cm.club_id = new.member_club_id
     and r.access_level = 'full'
  on conflict (club_id, user_id) do nothing;

  return new;
end $$;

drop trigger if exists club_group_members_owner_sync on public.club_group_members;
create trigger club_group_members_owner_sync
  after insert on public.club_group_members
  for each row execute function public.sync_group_owner_on_member_add();

-- Backfill : propager les owners des clubs déjà membres de regroupements existants.
do $$
declare
  m record;
begin
  for m in select group_club_id, member_club_id from public.club_group_members loop
    insert into public.club_memberships (club_id, user_id, role_id)
    select m.group_club_id, cm.user_id, gr.id
      from public.club_memberships cm
      join public.club_roles r  on r.id = cm.role_id and r.access_level = 'full'
      join public.club_roles gr on gr.club_id = m.group_club_id
                               and gr.access_level = 'full' and gr.is_system
     where cm.club_id = m.member_club_id
    on conflict (club_id, user_id) do nothing;
  end loop;
end $$;
