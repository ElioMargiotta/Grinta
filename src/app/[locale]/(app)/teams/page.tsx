import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Archive, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";
import { resolveCurrentMembership } from "@/lib/club/context";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";
import {
  SeasonImportWizard,
  type ImportSource,
} from "@/components/teams/SeasonImportWizard";
import { TeamList } from "@/components/teams/TeamList";

export default async function TeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { locale } = await params;
  const { onboarding } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("teams");
  const isOnboarding = onboarding === "1";

  // Scope to the currently selected club. Without this filter the RLS-only
  // query would return teams across every club the user belongs to, which
  // makes the ClubSwitcher useless.
  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);

  const season = await resolveCurrentSeasonLabel();

  const [{ data: teams }, { count: archivedCount }] = await Promise.all([
    // Vue par saison : on ne liste que les équipes PRÉSENTES dans la saison
    // active (table d'appartenance team_seasons). Une nouvelle saison démarre
    // donc vierge, puis se peuple via l'assistant d'import.
    supabase
      .from("teams")
      .select("id, name, season, age_group, team_seasons!inner(season)")
      .eq("club_id", membership.club_id)
      .is("archived_at", null)
      .eq("team_seasons.season", season)
      .order("created_at", { ascending: false }),
    supabase
      .from("teams")
      .select("id", { head: true, count: "exact" })
      .eq("club_id", membership.club_id)
      .not("archived_at", "is", null),
  ]);

  // Vue par saison : effectif et statut de planification scopés à la saison
  // active (l'équipe est persistante ; seul son contenu varie par saison).
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

  // Sources d'import : équipes des AUTRES saisons (non archivées), regroupées par
  // millésime, pour l'assistant « Importer depuis une saison précédente ».
  type TeamSeasonRow = {
    season: string;
    teams: { id: string; name: string; age_group: string | null; archived_at: string | null } | null;
  };
  const { data: otherSeasonRows } = await supabase
    .from("team_seasons")
    .select("season, teams!inner(id, name, age_group, archived_at)")
    .eq("club_id", membership.club_id)
    .neq("season", season)
    .returns<TeamSeasonRow[]>();

  const sourcesMap = new Map<string, ImportSource>();
  for (const row of otherSeasonRows ?? []) {
    if (!row.teams || row.teams.archived_at) continue;
    const entry = sourcesMap.get(row.season) ?? { season: row.season, teams: [] };
    entry.teams.push({
      id: row.teams.id,
      name: row.teams.name,
      age_group: row.teams.age_group,
    });
    sourcesMap.set(row.season, entry);
  }
  const importSources: ImportSource[] = [...sourcesMap.values()]
    .map((s) => ({
      ...s,
      teams: s.teams.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.season.localeCompare(a.season));

  return (
    <div className="flex flex-col gap-6">
      {isOnboarding && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="font-medium">
            {t("clubCreated", { name: membership.club_name })}
          </div>
          <p className="mt-1 text-emerald-800 dark:text-emerald-200">
            {t.rich("defaultTeamCreated", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("seasonScope", { season })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(archivedCount ?? 0) > 0 && (
            <Link href="/teams/archived">
              <Button variant="ghost" size="sm">
                <Archive className="h-4 w-4" />
                {t("archivedCount", { n: archivedCount ?? 0 })}
              </Button>
            </Link>
          )}
          <SeasonImportWizard targetSeason={season} sources={importSources} variant="ghost" />
          <Link href="/teams/new">
            <Button>
              <Plus className="h-4 w-4" />
              {t("new")}
            </Button>
          </Link>
        </div>
      </div>

      {!teams || teams.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border-y border-[var(--club-line)] bg-white/70 px-4 py-8">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
          {importSources.length > 0 ? (
            <SeasonImportWizard targetSeason={season} sources={importSources} />
          ) : null}
        </div>
      ) : (
        <TeamList
          teams={teams}
          basePath="/teams"
          playersByTeam={playersByTeam}
          plannedTeams={plannedTeams}
        />
      )}
    </div>
  );
}
