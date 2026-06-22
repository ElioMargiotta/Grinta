import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Activity } from "lucide-react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import {
  SessionPhysicalTests,
  type SessionTestMetric,
  type SessionTestResult,
} from "@/components/planner/SessionPhysicalTests";
import { requireMembership } from "@/lib/auth/getUser";
import { currentSeasonLabel } from "@/lib/planner/seasons";
import {
  resolveAvailability,
  type PlayerAvailability,
  type Unavailability,
  type UnavailabilityKind,
} from "@/lib/availability/unavailability";

type AssignmentRow = {
  player_id: string;
  players: {
    id: string;
    first_name: string;
    last_name: string;
    jersey_number: number | null;
  } | null;
};

type UnavailabilityDbRow = {
  player_id: string;
  kind: UnavailabilityKind;
  reason: string | null;
  start_date: string;
  end_date: string | null;
};

type AttendanceDbRow = {
  player_id: string;
  announced_status: "present" | "absent" | null;
  announced_reason: string | null;
  actual_status: "present" | "absent" | "injured" | null;
};

function formatDate(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function SessionTestPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string; sessionId: string }>;
}) {
  const { locale, teamId, sessionId } = await params;
  setRequestLocale(locale);
  const { supabase, membership } = await requireMembership(locale);
  const t = await getTranslations("planner.physicalTest");
  const currentLocale = await getLocale();
  const canRecordPhysical = membership.access_level !== "team_readonly";

  const [{ data: session }, { data: team }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, team_id, date, kind")
      .eq("id", sessionId)
      .single(),
    supabase.from("teams").select("id, name").eq("id", teamId).single(),
  ]);

  // Page réservée aux évals physiques (les entraînements ont leur préparation).
  if (
    !session ||
    !team ||
    session.team_id !== teamId ||
    session.kind !== "physical_eval"
  ) {
    notFound();
  }

  // Effectif de la saison de l'éval (déduite de sa date).
  const sessionSeason = currentSeasonLabel(new Date(session.date));
  const { data: assignmentsRaw } = await supabase
    .from("player_team_assignments")
    .select(
      `player_id,
       players (id, first_name, last_name, jersey_number)`,
    )
    .eq("team_id", teamId)
    .eq("season", sessionSeason);

  const assignments = (assignmentsRaw ?? []) as unknown as AssignmentRow[];
  const testPlayers = assignments
    .map((a) => {
      const p = a.players;
      if (!p) return null;
      return {
        playerId: p.id,
        fullName: `${p.first_name} ${p.last_name}`.trim(),
        jerseyNumber: p.jersey_number,
      };
    })
    .filter((p): p is { playerId: string; fullName: string; jerseyNumber: number | null } => p !== null)
    .sort((a, b) => {
      if (a.jerseyNumber !== null && b.jerseyNumber !== null) {
        return a.jerseyNumber - b.jerseyNumber;
      }
      if (a.jerseyNumber !== null) return -1;
      if (b.jerseyNumber !== null) return 1;
      return a.fullName.localeCompare(b.fullName);
    });

  // Tests du club + tests rattachés à l'éval + résultats déjà saisis.
  const [{ data: metricRows }, { data: attachedRows }, { data: resultRows }] =
    await Promise.all([
      supabase
        .from("physical_metrics")
        .select("id, name, unit, category, description, protocol")
        .eq("club_id", membership.club_id)
        .eq("archived", false)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .returns<SessionTestMetric[]>(),
      supabase
        .from("session_physical_tests")
        .select("metric_id")
        .eq("session_id", sessionId),
      supabase
        .from("physical_measurements")
        .select("player_id, metric_id, value")
        .eq("session_id", sessionId)
        .returns<SessionTestResult[]>(),
    ]);

  const physicalMetrics = metricRows ?? [];
  const attachedTestIds = (attachedRows ?? []).map((r) => r.metric_id as string);
  const testResults = resultRows ?? [];

  // Disponibilité par joueur à la date de l'éval : périodes médicales (couvrant
  // la date) + présence saisie pour la séance. Source de vérité = lib/availability.
  const testDate = session.date as string;
  const playerIds = testPlayers.map((p) => p.playerId);
  const [{ data: unavailRows }, { data: attendanceRows }] = playerIds.length
    ? await Promise.all([
        supabase
          .from("player_unavailability")
          .select("player_id, kind, reason, start_date, end_date")
          .in("player_id", playerIds)
          .lte("start_date", testDate)
          .or(`end_date.is.null,end_date.gte.${testDate}`)
          .returns<UnavailabilityDbRow[]>(),
        supabase
          .from("session_attendances")
          .select("player_id, announced_status, announced_reason, actual_status")
          .eq("session_id", sessionId)
          .returns<AttendanceDbRow[]>(),
      ])
    : [
        { data: [] as UnavailabilityDbRow[] },
        { data: [] as AttendanceDbRow[] },
      ];

  const unavailByPlayer = new Map<string, Unavailability[]>();
  for (const u of unavailRows ?? []) {
    const arr = unavailByPlayer.get(u.player_id) ?? [];
    arr.push({
      id: "",
      playerId: u.player_id,
      kind: u.kind,
      reason: u.reason,
      startDate: u.start_date,
      endDate: u.end_date,
    });
    unavailByPlayer.set(u.player_id, arr);
  }
  const attendanceByPlayer = new Map(
    (attendanceRows ?? []).map((a) => [a.player_id, a]),
  );

  const availability: Record<string, PlayerAvailability> = {};
  for (const p of testPlayers) {
    const att = attendanceByPlayer.get(p.playerId);
    availability[p.playerId] = resolveAvailability({
      unavailabilities: unavailByPlayer.get(p.playerId) ?? [],
      date: testDate,
      actualStatus: att?.actual_status ?? null,
      announcedStatus: att?.announced_status ?? null,
      announcedReason: att?.announced_reason ?? null,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/${locale}/planner/${teamId}?view=weekly`}
          className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("backToPlanner")}
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          <Activity className="h-6 w-6 text-[var(--club-primary)]" />
          {t("title")} — {team.name}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {formatDate(session.date as string, currentLocale)}
        </p>
      </div>

      <Card>
        <SessionPhysicalTests
          locale={locale}
          teamId={teamId}
          sessionId={sessionId}
          players={testPlayers}
          metrics={physicalMetrics}
          attachedIds={attachedTestIds}
          results={testResults}
          availability={availability}
          canRecord={canRecordPhysical}
        />
      </Card>
    </div>
  );
}
