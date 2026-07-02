-- Lot 0 — Owner-sync symétrique club membre ↔ regroupement.
--
-- La v1 (20260702130000) ne propageait l'owner qu'à l'AJOUT d'un club membre :
--  - un owner ajouté PLUS TARD à un club membre n'était pas propagé ;
--  - un owner RETIRÉ d'un club membre gardait l'accès au regroupement (faille).
--
-- Désormais, sur club_memberships :
--  - devient `full` dans un club membre → membership owner (rôle full système)
--    ajouté sur chaque regroupement du club ;
--  - perd `full` (delete ou changement de rôle) → membership owner du regroupement
--    retiré, SAUF s'il reste owner d'un autre club membre du même regroupement.
--    Limite assumée v1 : un owner invité aussi DIRECTEMENT au regroupement (même
--    rôle full système) sera retiré avec — cas marginal, réévaluer si besoin.

create or replace function private.sync_group_owner_on_membership_change()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_new_full boolean := false;
  v_old_full boolean := false;
  g record;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select r.access_level = 'full' into v_new_full
      from public.club_roles r where r.id = new.role_id;
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    select r.access_level = 'full' into v_old_full
      from public.club_roles r where r.id = old.role_id;
  end if;

  -- Propagation : devient owner d'un club membre → owner des regroupements.
  if coalesce(v_new_full, false) and not coalesce(v_old_full, false) then
    for g in
      select m.group_club_id
        from public.club_group_members m
       where m.member_club_id = new.club_id
    loop
      insert into public.club_memberships (club_id, user_id, role_id)
      select g.group_club_id, new.user_id, gr.id
        from public.club_roles gr
       where gr.club_id = g.group_club_id
         and gr.access_level = 'full' and gr.is_system
       order by gr.created_at asc
       limit 1
      on conflict (club_id, user_id) do nothing;
    end loop;
  end if;

  -- Retrait : perd owner d'un club membre → retiré du regroupement, sauf s'il
  -- reste owner d'un autre club membre du même regroupement.
  if coalesce(v_old_full, false)
     and (tg_op = 'DELETE' or not coalesce(v_new_full, false)) then
    for g in
      select m.group_club_id
        from public.club_group_members m
       where m.member_club_id = old.club_id
    loop
      if not exists (
        select 1
          from public.club_group_members m2
          join public.club_memberships cm on cm.club_id = m2.member_club_id
                                         and cm.user_id = old.user_id
          join public.club_roles r on r.id = cm.role_id
         where m2.group_club_id = g.group_club_id
           and m2.member_club_id <> old.club_id
           and r.access_level = 'full'
      ) then
        delete from public.club_memberships cm
         using public.club_roles r
         where cm.club_id = g.group_club_id
           and cm.user_id = old.user_id
           and r.id = cm.role_id
           and r.access_level = 'full' and r.is_system;
      end if;
    end loop;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists club_memberships_group_owner_sync on public.club_memberships;
create trigger club_memberships_group_owner_sync
  after insert or update of role_id or delete on public.club_memberships
  for each row execute function private.sync_group_owner_on_membership_change();
