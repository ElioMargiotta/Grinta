import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { TeamList } from "@/components/teams/TeamList";
import { requireUser } from "@/lib/auth/getUser";
import { resolveCurrentMembership } from "@/lib/club/context";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";

export default async function PlannerIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("planner");

  // Scope to the currently selected club (see TeamsPage for rationale).
  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);

  // Vue par saison : seules les équipes présentes dans la saison active (table
  // d'appartenance team_seasons) sont planifiables.
  const season = await resolveCurrentSeasonLabel();
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, season, age_group, team_seasons!inner(season)")
    .eq("club_id", membership.club_id)
    .is("archived_at", null)
    .eq("team_seasons.season", season)
    .order("created_at", { ascending: false });

  // Effectif et statut de planification scopés à la saison active — affichés
  // dans la liste comme dans l'onglet Équipes.
  const teamIds = (teams ?? []).map((tm) => tm.id);
  const [assignRes, plansRes] = teamIds.length
    ? await Promise.all([
        supabase
          .from("player_team_assignments")
          .select("team_id")
          .in("team_id", teamIds)
          .eq("season", season),
        supabase
          .from("season_plans")
          .select("team_id")
          .in("team_id", teamIds)
          .eq("season_label", season)
          .neq("status", "archived"),
      ])
    : [{ data: [] as { team_id: string }[] }, { data: [] as { team_id: string }[] }];

  const playersByTeam = new Map<string, number>();
  for (const a of assignRes.data ?? []) {
    playersByTeam.set(a.team_id, (playersByTeam.get(a.team_id) ?? 0) + 1);
  }
  const plannedTeams = new Set((plansRes.data ?? []).map((p) => p.team_id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("seasonScope", { season })}
        </p>
      </div>

      {!teams || teams.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("noTeams")}</p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("pickTeam")}</p>
          <TeamList
            teams={teams}
            basePath="/planner"
            playersByTeam={playersByTeam}
            plannedTeams={plannedTeams}
          />
        </>
      )}
    </div>
  );
}
