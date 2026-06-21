import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireMembership } from "@/lib/auth/getUser";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";
import { isClubWideLevel } from "@/lib/club/types";
import { listClubTeams } from "@/lib/contingent/teams";
import { ensureDefaultMetrics } from "@/lib/physical/ensureDefaults";
import {
  PhysicalHubView,
  type HubEval,
  type HubMeasurement,
  type HubPlayer,
} from "@/components/physical/PhysicalHubView";
import type { PhysicalMetric } from "@/components/contingent/PhysicalTrackingSection";

type PlayerRow = {
  id: string;
  first_name: string;
  last_name: string;
  player_team_assignments: { team_id: string }[] | null;
};

type MeasurementRow = {
  player_id: string;
  metric_id: string;
  measured_on: string;
  value: number | null;
};

type EvalRow = {
  id: string;
  date: string;
  team_id: string;
  teams: { name: string | null } | null;
};

export default async function PhysiquePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user, membership } = await requireMembership(locale);
  const t = await getTranslations("physicalHub");
  const season = await resolveCurrentSeasonLabel();

  // Bibliothèque par défaut visible d'office (idempotent).
  await ensureDefaultMetrics(supabase, membership.club_id, user.id);

  const [
    { data: metricRows },
    { data: playerRows },
    { data: measurementRows },
    teams,
    { data: evalRows },
  ] =
    await Promise.all([
      supabase
        .from("physical_metrics")
        .select(
          "id, name, unit, category, description, protocol, higher_is_better, sort_order, archived, subcategory, value_type, interpretation, material, trials, validity_conditions, recommended_frequency, display, alert_threshold, default_key",
        )
        .eq("club_id", membership.club_id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .returns<PhysicalMetric[]>(),
      supabase
        .from("players")
        .select(
          "id, first_name, last_name, player_team_assignments ( team_id, season )",
        )
        .eq("club_id", membership.club_id)
        .eq("player_team_assignments.season", season)
        .order("last_name", { ascending: true })
        .returns<PlayerRow[]>(),
      supabase
        .from("physical_measurements")
        .select("player_id, metric_id, measured_on, value")
        .eq("club_id", membership.club_id)
        .order("measured_on", { ascending: true })
        .returns<MeasurementRow[]>(),
      listClubTeams(membership.club_id, season),
      supabase
        .from("sessions")
        .select("id, date, team_id, teams!inner(name, club_id)")
        .eq("teams.club_id", membership.club_id)
        .eq("kind", "physical_eval")
        .order("date", { ascending: false })
        .returns<EvalRow[]>(),
    ]);

  // Comptage des tests par éval pour l'affichage de la liste.
  const evalIds = (evalRows ?? []).map((e) => e.id);
  const { data: evalTestRows } = evalIds.length
    ? await supabase
        .from("session_physical_tests")
        .select("session_id")
        .in("session_id", evalIds)
    : { data: [] as { session_id: string }[] };
  const testCountByEval = new Map<string, number>();
  for (const r of evalTestRows ?? []) {
    testCountByEval.set(r.session_id, (testCountByEval.get(r.session_id) ?? 0) + 1);
  }

  const evals: HubEval[] = (evalRows ?? []).map((e) => ({
    id: e.id,
    teamId: e.team_id,
    teamName: e.teams?.name ?? "—",
    date: e.date,
    testCount: testCountByEval.get(e.id) ?? 0,
  }));

  const players: HubPlayer[] = (playerRows ?? []).map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`.trim(),
    teamIds: (p.player_team_assignments ?? []).map((a) => a.team_id),
  }));

  const measurements: HubMeasurement[] = (measurementRows ?? [])
    .filter((m) => m.value !== null)
    .map((m) => ({
      playerId: m.player_id,
      metricId: m.metric_id,
      measuredOn: m.measured_on,
      value: m.value as number,
    }));

  const canManageMetrics = isClubWideLevel(membership.access_level);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("subtitle", { club: membership.club_name })} · {t("seasonScope", { season })}
        </p>
      </div>

      <PhysicalHubView
        locale={locale}
        metrics={metricRows ?? []}
        players={players}
        measurements={measurements}
        teams={teams.map((tm) => ({ id: tm.id, name: tm.name }))}
        evals={evals}
        canManageMetrics={canManageMetrics}
      />
    </div>
  );
}
