-- Chantier D — Retrait du stopgap `clubs.member_clubs` (label libre « clubs du
-- regroupement »). Il est remplacé par les vrais regroupements (club-contexte
-- `is_group=true` + `club_group_members`) : la page club affiche désormais les
-- regroupements réels (listClubGroupsForClub), le label libre est redondant.

drop function if exists public.admin_set_club_member_clubs(uuid, text[]);

alter table public.clubs
  drop constraint if exists clubs_member_clubs_max;

alter table public.clubs
  drop column if exists member_clubs;

notify pgrst, 'reload schema';
