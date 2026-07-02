-- Lot 0 — Quick wins perf/sécurité issus des advisors Supabase (2026-07-02).
--
-- 1. auth_rls_initplan : 2 policies appellent auth.uid()/auth.jwt() nus → réévalués
--    PAR LIGNE. On les wrappe en sous-select (évalué une fois par requête).
-- 2. 9 FK sans index (advisor unindexed_foreign_keys).
-- 3. 5 fonctions trigger updated_at sans search_path fixe (advisor
--    function_search_path_mutable) — elles ne référencent que new.* et now().
-- 4. club_group_shares.created_by sans FK (oubli de la migration shares).

-- 1. Policies initplan-safe (mêmes prédicats, auth.* wrappé).

drop policy if exists club_invitations_read_invitee on public.club_invitations;
create policy club_invitations_read_invitee on public.club_invitations
  for select using (
    (select auth.uid()) is not null
    and (
      target_user_id = (select auth.uid())
      or (email is not null
          and lower(email) = lower((select auth.jwt() ->> 'email')))
    )
  );

drop policy if exists players_read_pending_invitee on public.players;
create policy players_read_pending_invitee on public.players
  for select using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.club_invitations i
      where i.player_id = players.id
        and i.kind in ('player'::public.invitation_kind, 'guardian'::public.invitation_kind)
        and i.status = 'pending'::public.invitation_status
        and i.expires_at > now()
        and (
          i.target_user_id = (select auth.uid())
          or (i.email is not null
              and lower(i.email) = lower((select auth.jwt() ->> 'email')))
        )
    )
  );

-- 2. Index sur les FK non couvertes.

create index if not exists club_licenses_created_by_idx
  on public.club_licenses (created_by);
create index if not exists license_events_actor_idx
  on public.license_events (actor);
create index if not exists match_events_player_idx
  on public.match_events (player_id);
create index if not exists match_events_related_player_idx
  on public.match_events (related_player_id);
create index if not exists notifications_actor_user_idx
  on public.notifications (actor_user_id);
create index if not exists notifications_club_idx
  on public.notifications (club_id);
create index if not exists platform_admins_created_by_idx
  on public.platform_admins (created_by);
create index if not exists player_unavailability_created_by_idx
  on public.player_unavailability (created_by);
create index if not exists session_staff_attendances_actual_marked_by_idx
  on public.session_staff_attendances (actual_marked_by);

-- 3. search_path fixe sur les triggers updated_at.

alter function public.set_session_attendances_updated_at() set search_path = '';
alter function public.set_team_calendar_updated_at() set search_path = '';
alter function public.set_player_unavailability_updated_at() set search_path = '';
alter function public.set_match_participations_updated_at() set search_path = '';
alter function public.set_session_staff_attendances_updated_at() set search_path = '';

-- 4. FK manquante (créateur du réglage de partage ; convention actuelle = auth.users,
--    harmonisation vers profiles prévue au Lot 2 avec les autres colonnes acteur).

alter table public.club_group_shares
  drop constraint if exists club_group_shares_created_by_fkey,
  add constraint club_group_shares_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
create index if not exists club_group_shares_created_by_idx
  on public.club_group_shares (created_by);
