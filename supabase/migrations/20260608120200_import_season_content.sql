-- Saison vierge + import — Migration C : RPC d'import inter-saisons
--
-- Recrée dans une saison cible la structure choisie d'une saison source :
--   * équipes        → lignes team_seasons (rend les équipes visibles)
--   * effectifs      → player_team_assignments recopiés (saison ré-estampillée)
--   * périodisation  → team_periodization_settings recopiés
-- JAMAIS de matchs / calendriers ICS / plans de saison (propres à la saison).
-- Idempotent : tout est en ON CONFLICT DO NOTHING (ré-exécutable sans doublon).
-- Non destructif : ne touche jamais la saison source.

BEGIN;

CREATE OR REPLACE FUNCTION public.import_season_content(
  p_club_id            uuid,
  p_source_season      text,
  p_target_season      text,
  p_team_ids           uuid[],
  p_include_rosters    boolean DEFAULT false,
  p_include_periodization boolean DEFAULT false
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_lvl  access_level;
  v_teams int := 0;
  v_rosters int := 0;
  v_periodization int := 0;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_club_id is null then
    raise exception 'club_id is required';
  end if;
  if p_source_season !~ '^\d{4}/\d{2}$' or p_target_season !~ '^\d{4}/\d{2}$' then
    raise exception 'invalid season label';
  end if;
  if p_source_season = p_target_season then
    raise exception 'source and target seasons must differ';
  end if;
  if p_team_ids is null or array_length(p_team_ids, 1) is null then
    raise exception 'no team selected';
  end if;

  v_lvl := private.user_club_access(p_club_id);
  if v_lvl is null or v_lvl not in ('full', 'extended', 'team') then
    raise exception 'insufficient access to this club';
  end if;
  if not private.club_is_active(p_club_id) then
    raise exception 'club not active';
  end if;

  -- Périmètre : équipes du club, présentes dans la saison source ET choisies.
  -- Inliné dans chaque INSERT (via EXISTS) — pas de table temporaire, robuste
  -- sous pooling transaction.

  -- 1) Équipes → visibles dans la saison cible.
  insert into public.team_seasons (team_id, season, club_id)
  select ts.team_id, p_target_season, p_club_id
    from public.team_seasons ts
   where ts.club_id = p_club_id
     and ts.season = p_source_season
     and ts.team_id = any(p_team_ids)
  on conflict (team_id, season) do nothing;
  get diagnostics v_teams = row_count;

  -- 2) Effectifs → affectations recopiées avec la saison cible.
  if p_include_rosters then
    insert into public.player_team_assignments (player_id, team_id, season, role)
    select a.player_id, a.team_id, p_target_season, a.role
      from public.player_team_assignments a
     where a.season = p_source_season
       and exists (
         select 1 from public.team_seasons ts
          where ts.team_id = a.team_id
            and ts.club_id = p_club_id
            and ts.season = p_source_season
            and ts.team_id = any(p_team_ids)
       )
    on conflict (player_id, team_id, coalesce(season, '')) do nothing;
    get diagnostics v_rosters = row_count;
  end if;

  -- 3) Périodisation → réglages de rythme recopiés.
  if p_include_periodization then
    insert into public.team_periodization_settings
      (team_id, club_id, season, training_weekdays, md_scheme)
    select s.team_id, s.club_id, p_target_season, s.training_weekdays, s.md_scheme
      from public.team_periodization_settings s
     where s.season = p_source_season
       and exists (
         select 1 from public.team_seasons ts
          where ts.team_id = s.team_id
            and ts.club_id = p_club_id
            and ts.season = p_source_season
            and ts.team_id = any(p_team_ids)
       )
    on conflict (team_id, season) do nothing;
    get diagnostics v_periodization = row_count;
  end if;

  return jsonb_build_object(
    'teams', v_teams,
    'rosters', v_rosters,
    'periodization', v_periodization
  );
end $$;

GRANT EXECUTE ON FUNCTION public.import_season_content(uuid, text, text, uuid[], boolean, boolean) TO authenticated;

COMMIT;
