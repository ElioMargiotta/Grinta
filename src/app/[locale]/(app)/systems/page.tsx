import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { TeamList } from "@/components/teams/TeamList";
import { requireUser } from "@/lib/auth/getUser";
import { resolveCurrentMembership } from "@/lib/club/context";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";

export default async function SystemsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("planner");
  const tSys = await getTranslations("planner.systems");

  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);

  // Mêmes équipes que l'onglet Planning : celles de la saison active.
  const season = await resolveCurrentSeasonLabel();
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, season, age_group, team_seasons!inner(season)")
    .eq("club_id", membership.club_id)
    .is("archived_at", null)
    .eq("team_seasons.season", season)
    .order("created_at", { ascending: false });

  const teamIds = (teams ?? []).map((tm) => tm.id);
  const { data: assignData } = teamIds.length
    ? await supabase
        .from("player_team_assignments")
        .select("team_id")
        .in("team_id", teamIds)
        .eq("season", season)
    : { data: [] as { team_id: string }[] };

  const playersByTeam = new Map<string, number>();
  for (const a of assignData ?? []) {
    playersByTeam.set(a.team_id, (playersByTeam.get(a.team_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {tSys("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {tSys("subtitle")}
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
            basePath="/systems"
            playersByTeam={playersByTeam}
            plannedTeams={new Set()}
          />
        </>
      )}
    </div>
  );
}
