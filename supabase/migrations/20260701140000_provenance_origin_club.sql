-- Phase 1 — Fondations de la refonte structure des clubs (groupements + fusions).
-- Provenance immuable : chaque donnée joueur/historique porte son CLUB D'ORIGINE
-- (`origin_club_id`). Objectif : historique attribuable pour toujours après une
-- fusion, et surtout rendre possible la fusion OUT (rupture/division) — on sait
-- renvoyer chaque donnée à son club d'origine.
--
-- Additif et SANS changement de comportement : aucune policy RLS modifiée, aucun
-- code applicatif touché. La colonne est peuplée automatiquement (trigger) et
-- gelée (write-once). Seul le futur moteur de fusion réécrira `club_id` — jamais
-- `origin_club_id`.
--
-- Cibles = tables données/historique à `club_id` DIRECT (celles dont le club_id
-- sera réécrit lors d'une fusion). Les tables scopées indirectement (via team_id/
-- player_id/session_id) héritent de la provenance de leur parent et sont exclues.

-- 1. Fonctions trigger réutilisables (schéma private).

create or replace function private.set_origin_club_id()
  returns trigger
  language plpgsql
as $$
begin
  -- À l'insertion, la provenance vaut le club courant si non fournie.
  if new.origin_club_id is null then
    new.origin_club_id := new.club_id;
  end if;
  return new;
end $$;

create or replace function private.freeze_origin_club_id()
  returns trigger
  language plpgsql
as $$
begin
  -- Write-once : la provenance ne change jamais.
  if new.origin_club_id is distinct from old.origin_club_id then
    raise exception 'origin_club_id is immutable';
  end if;
  return new;
end $$;

-- 2. Application du pattern à chaque table cible.

do $$
declare
  t text;
  tables text[] := array[
    'players', 'teams', 'exercises', 'player_evaluations', 'physical_metrics',
    'physical_measurements', 'player_unavailability', 'team_tactical_systems',
    'team_tactical_phases', 'team_calendar_subscriptions', 'team_matches',
    'match_participations', 'team_periodization_settings', 'team_seasons',
    'season_plans'
  ];
begin
  foreach t in array tables loop
    execute format(
      'alter table public.%I add column if not exists origin_club_id uuid references public.clubs(id)', t);

    -- Backfill (avant création du trigger de gel) : origine = club courant.
    execute format(
      'update public.%I set origin_club_id = club_id where origin_club_id is null', t);

    execute format(
      'create index if not exists %I on public.%I (origin_club_id)', t || '_origin_club_idx', t);

    execute format('drop trigger if exists set_origin_club_id on public.%I', t);
    execute format(
      'create trigger set_origin_club_id before insert on public.%I
         for each row execute function private.set_origin_club_id()', t);

    execute format('drop trigger if exists freeze_origin_club_id on public.%I', t);
    execute format(
      'create trigger freeze_origin_club_id before update on public.%I
         for each row execute function private.freeze_origin_club_id()', t);
  end loop;

  -- NOT NULL partout où club_id l'est. Seul `exercises` a un club_id nullable
  -- (exercices personnels sans club) → origine nullable aussi.
  foreach t in array tables loop
    if t <> 'exercises' then
      execute format('alter table public.%I alter column origin_club_id set not null', t);
    end if;
  end loop;
end $$;
