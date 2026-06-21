import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireMembership } from "@/lib/auth/getUser";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";
import { isClubWideLevel } from "@/lib/club/types";
import { listClubTeams } from "@/lib/contingent/teams";
import {
  PhysicalHubView,
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

export default async function PhysiquePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, membership } = await requireMembership(locale);
  const t = await getTranslations("physicalHub");
  const season = await resolveCurrentSeasonLabel();

  const [{ data: metricRows }, { data: playerRows }, { data: measurementRows }, teams] =
    await Promise.all([
      supabase
        .from("physical_metrics")
        .select(
          "id, name, unit, category, description, protocol, higher_is_better, sort_order, archived",
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
    ]);

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
        canManageMetrics={canManageMetrics}
      />
    </div>
  );
}
