"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentMembership } from "@/lib/club/context";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";

const SEASON_RE = /^\d{4}\/\d{2}$/;

type ImportResult = {
  ok?: true;
  error?:
    | "unauthenticated"
    | "no_membership"
    | "invalid_season"
    | "same_season"
    | "no_team"
    | "db_error";
  imported?: { teams: number; rosters: number; periodization: number };
};

/**
 * Importe dans la SAISON ACTIVE la structure choisie d'une saison source :
 * équipes (toujours), + effectifs et/ou périodisation en option. Délègue à la
 * RPC `import_season_content` (idempotente, non destructive — ne touche jamais
 * la saison source). Les matchs / calendriers ICS ne sont jamais importés.
 */
export async function importSeasonContentAction(
  formData: FormData,
): Promise<ImportResult> {
  const sourceSeason = String(formData.get("sourceSeason") ?? "");
  const teamIds = formData
    .getAll("teamIds")
    .map((v) => String(v))
    .filter(Boolean);
  const includeRosters = formData.get("includeRosters") === "on";
  const includePeriodization = formData.get("includePeriodization") === "on";

  if (!SEASON_RE.test(sourceSeason)) return { error: "invalid_season" };
  if (teamIds.length === 0) return { error: "no_team" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const membership = await resolveCurrentMembership();
  if (!membership) return { error: "no_membership" };

  const targetSeason = await resolveCurrentSeasonLabel();
  if (sourceSeason === targetSeason) return { error: "same_season" };

  const { data, error } = await supabase.rpc("import_season_content", {
    p_club_id: membership.club_id,
    p_source_season: sourceSeason,
    p_target_season: targetSeason,
    p_team_ids: teamIds,
    p_include_rosters: includeRosters,
    p_include_periodization: includePeriodization,
  });
  if (error) return { error: "db_error" };

  const counts = (data ?? {}) as {
    teams?: number;
    rosters?: number;
    periodization?: number;
  };

  revalidatePath("/", "layout");
  return {
    ok: true,
    imported: {
      teams: counts.teams ?? 0,
      rosters: counts.rosters ?? 0,
      periodization: counts.periodization ?? 0,
    },
  };
}
