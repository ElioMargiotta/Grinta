import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireMembership } from "@/lib/auth/getUser";
import {
  type EditablePlayer,
} from "@/components/contingent/ClubPlayerForm";
import { ContingentPlayerProfile } from "@/components/contingent/ContingentPlayerProfile";
import {
  type PlayerInvitation,
} from "@/components/contingent/InvitePlayerSection";
import {
  type EvaluationRow,
} from "@/components/evaluation/EvaluationsSection";
import {
  type PhysicalMetric,
  type PhysicalMeasurement,
} from "@/components/contingent/PhysicalTrackingSection";
import {
  overallAverage,
  mergeEvaluation,
  type EvaluationData,
} from "@/components/evaluation/types";
import { listClubTeams } from "@/lib/contingent/teams";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";
import { getPlayersOverview } from "@/lib/contingent/playerStats";
import {
  coversDate,
  type Unavailability,
  type UnavailabilityKind,
} from "@/lib/availability/unavailability";

type UnavailabilityDbRow = {
  id: string;
  kind: UnavailabilityKind;
  reason: string | null;
  start_date: string;
  end_date: string | null;
};

type EvaluationDbRow = {
  id: string;
  season: string | null;
  evaluation_date: string | null;
  data: Partial<EvaluationData> | null;
  shared_with_player?: boolean | null;
};

export default async function ContingentPlayerPage({
  params,
}: {
  params: Promise<{ locale: string; playerId: string }>;
}) {
  const { locale, playerId } = await params;
  setRequestLocale(locale);
  const { supabase, membership } = await requireMembership(locale);
  const t = await getTranslations("contingent");
  const season = await resolveCurrentSeasonLabel();

  const { data: player } = await supabase
    .from("players")
    .select(
      `id, first_name, last_name, birth_date, position, jersey_number, notes,
       strong_foot, license_number, js_number, email, phone, nationality,
       address, postal_code, city, canton, user_id,
       guardian_name, guardian_email, guardian_phone,
       guardian2_name, guardian2_email, guardian2_phone,
       dual_licence_club, dual_licence_level, dual_licence_team`,
    )
    .eq("id", playerId)
    .single<EditablePlayer & { user_id: string | null }>();

  if (!player) notFound();

  // Affectations actuelles (saison NULL = "courante"), pour pré-cocher le
  // picker du bloc dédié (#39).
  const [
    { data: assignments },
    teams,
    { data: inviteRows },
  ] = await Promise.all([
    supabase
      .from("player_team_assignments")
      .select("team_id")
      .eq("player_id", playerId)
      .eq("season", season),
    listClubTeams(membership.club_id, season),
    supabase
      .from("club_invitations")
      .select("id, email, status, team_id, expires_at, email_status, email_sent_at")
      .eq("player_id", playerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  let evaluationsShareAvailable = true;
  let evalRows: EvaluationDbRow[] | null = null;
  const { data: fullEvalRows, error: evalError } = await supabase
    .from("player_evaluations")
    .select("id, season, evaluation_date, data, created_at, shared_with_player")
    .eq("player_id", playerId)
    .order("evaluation_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<EvaluationDbRow[]>();
  evalRows = fullEvalRows;

  if (evalError) {
    evaluationsShareAvailable = false;
    const fallback = await supabase
      .from("player_evaluations")
      .select("id, season, evaluation_date, data, created_at")
      .eq("player_id", playerId)
      .order("evaluation_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .returns<EvaluationDbRow[]>();
    evalRows = fallback.data;
  }

  // Suivi physique — indicateurs du club + mesures du joueur + indisponibilités.
  const [{ data: metricRows }, { data: measurementRows }, { data: unavailRows }] =
    await Promise.all([
      supabase
        .from("physical_metrics")
        .select("id, name, unit, category, description, protocol, higher_is_better, sort_order, archived")
        .eq("club_id", membership.club_id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .returns<PhysicalMetric[]>(),
      supabase
        .from("physical_measurements")
        .select("metric_id, measured_on, value, note")
        .eq("player_id", playerId)
        .order("measured_on", { ascending: true })
        .returns<PhysicalMeasurement[]>(),
      supabase
        .from("player_unavailability")
        .select("id, kind, reason, start_date, end_date")
        .eq("player_id", playerId)
        .order("start_date", { ascending: false })
        .returns<UnavailabilityDbRow[]>(),
    ]);

  const physicalMetrics = metricRows ?? [];
  const physicalMeasurements = measurementRows ?? [];
  const unavailabilities: Unavailability[] = (unavailRows ?? []).map((u) => ({
    id: u.id,
    playerId,
    kind: u.kind,
    reason: u.reason,
    startDate: u.start_date,
    endDate: u.end_date,
  }));

  // KPIs de la fiche (présence + disponibilité). Présence/séances depuis
  // l'agrégateur serveur ; disponibilité = jours sans indispo sur la saison.
  const overview = (await getPlayersOverview(supabase, { season, playerIds: [playerId] })).get(
    playerId,
  );
  const todayKpi = new Date().toISOString().slice(0, 10);
  const seasonStartKpi = `${Number(season.slice(0, 4)) || 1970}-07-01`;
  const unavailableDays = new Set<string>();
  for (const u of unavailabilities) {
    const from = u.startDate > seasonStartKpi ? u.startDate : seasonStartKpi;
    const to = u.endDate && u.endDate < todayKpi ? u.endDate : todayKpi;
    for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (iso >= seasonStartKpi && iso <= todayKpi && coversDate(u, iso)) {
        unavailableDays.add(iso);
      }
    }
  }
  const elapsedDays = Math.max(
    1,
    Math.round(
      (new Date(todayKpi).getTime() - new Date(seasonStartKpi).getTime()) / 86_400_000,
    ) + 1,
  );
  const playerStats = {
    presenceRate: overview?.presenceRate ?? null,
    sessionsPresent: overview?.sessionsPresent ?? 0,
    sessionsTotal: overview?.sessionsTotal ?? 0,
    availabilityRate: Math.max(0, (elapsedDays - unavailableDays.size) / elapsedDays),
  };
  const canRecordPhysical = membership.access_level !== "team_readonly";

  const currentTeamIds = (assignments ?? []).map((a) => a.team_id as string);

  // Prochaine séance (toutes équipes du joueur) pour l'onglet Aperçu.
  const { data: nextSessionRow } = currentTeamIds.length
    ? await supabase
        .from("sessions")
        .select("id, date, theme, kind, teams(name)")
        .in("team_id", currentTeamIds)
        .gte("date", todayKpi)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: true })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const nextSessionTeam = (nextSessionRow as { teams?: { name: string } | { name: string }[] | null } | null)?.teams;
  const nextSession = nextSessionRow
    ? {
        date: nextSessionRow.date as string,
        theme: (nextSessionRow.theme as string | null) ?? null,
        kind: (nextSessionRow.kind as string) ?? "training",
        teamName:
          (Array.isArray(nextSessionTeam) ? nextSessionTeam[0]?.name : nextSessionTeam?.name) ??
          null,
      }
    : null;

  const lastTestDate =
    physicalMeasurements.length > 0
      ? physicalMeasurements[physicalMeasurements.length - 1].measured_on
      : null;

  const evaluations: EvaluationRow[] = (evalRows ?? []).map((row) => {
    const merged = mergeEvaluation(row.data as Partial<EvaluationData> | null);
    return {
      id: row.id as string,
      evaluation_date: (row.evaluation_date as string | null) ?? null,
      season: (row.season as string | null) ?? null,
      appreciation: merged.appreciation,
      average: overallAverage(merged.tips),
      shared_with_player: (row.shared_with_player as boolean) ?? false,
    };
  });

  const pendingInvitations: PlayerInvitation[] = (inviteRows ?? []).map((r) => ({
    id: r.id as string,
    email: r.email as string,
    status: r.status as PlayerInvitation["status"],
    team_id: (r.team_id as string | null) ?? null,
    expires_at: r.expires_at as string,
    email_status: (r.email_status as PlayerInvitation["email_status"]) ?? "pending",
    email_sent_at: (r.email_sent_at as string | null) ?? null,
  }));

  const fullName = `${player.first_name} ${player.last_name}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link
        href="/contingent"
        className="inline-flex w-fit items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("title")}
      </Link>

      <ContingentPlayerProfile
        player={player}
        fullName={fullName}
        teams={teams}
        currentTeamIds={currentTeamIds}
        pendingInvitations={pendingInvitations}
        evaluations={evaluations}
        evaluationsShareAvailable={evaluationsShareAvailable}
        physicalMetrics={physicalMetrics}
        physicalMeasurements={physicalMeasurements}
        unavailabilities={unavailabilities}
        stats={playerStats}
        nextSession={nextSession}
        lastTestDate={lastTestDate}
        canRecordPhysical={canRecordPhysical}
        locale={locale}
      />
    </div>
  );
}
