import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import {
  AttendanceRoster,
  type RosterEntry,
} from "@/components/planner/AttendanceRoster";
import {
  SessionPhysicalTests,
  type SessionTestMetric,
  type SessionTestResult,
} from "@/components/planner/SessionPhysicalTests";
import { requireMembership } from "@/lib/auth/getUser";
import { currentSeasonLabel } from "@/lib/planner/seasons";

type AssignmentRow = {
  player_id: string;
  players: {
    id: string;
    first_name: string;
    last_name: string;
    jersey_number: number | null;
  } | null;
};

type AttendanceRow = {
  player_id: string;
  announced_status: "present" | "absent" | null;
  announced_reason: string | null;
  announced_at: string | null;
  actual_status: "present" | "absent" | null;
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

export default async function SessionAttendancePage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string; sessionId: string }>;
}) {
  const { locale, teamId, sessionId } = await params;
  setRequestLocale(locale);
  const { supabase, membership } = await requireMembership(locale);
  const t = await getTranslations("attendance.coach");
  const currentLocale = await getLocale();
  const canRecordPhysical = membership.access_level !== "team_readonly";

  const [{ data: session }, { data: team }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, team_id, date, start_time, theme, rsvp_deadline_hours")
      .eq("id", sessionId)
      .single(),
    supabase.from("teams").select("id, name").eq("id", teamId).single(),
  ]);

  if (!session || !team || session.team_id !== teamId) notFound();

  // Effectif de la saison de la SÉANCE (déduite de sa date), pour que la liste
  // de présence reste cohérente même hors saison active.
  const sessionSeason = currentSeasonLabel(new Date(session.date));
  const [{ data: assignmentsRaw }, { data: attendancesRaw }] = await Promise.all([
    supabase
      .from("player_team_assignments")
      .select(
        `player_id,
         players (id, first_name, last_name, jersey_number)`,
      )
      .eq("team_id", teamId)
      .eq("season", sessionSeason),
    supabase
      .from("session_attendances")
      .select("player_id, announced_status, announced_reason, announced_at, actual_status")
      .eq("session_id", sessionId),
  ]);

  const assignments = (assignmentsRaw ?? []) as unknown as AssignmentRow[];
  const attendances = (attendancesRaw ?? []) as AttendanceRow[];
  const attByPlayer = new Map(attendances.map((a) => [a.player_id, a]));

  const roster: RosterEntry[] = assignments
    .map((a) => {
      const p = a.players;
      if (!p) return null;
      const att = attByPlayer.get(p.id);
      return {
        playerId: p.id,
        fullName: `${p.first_name} ${p.last_name}`.trim(),
        jerseyNumber: p.jersey_number,
        announcedStatus: att?.announced_status ?? null,
        announcedReason: att?.announced_reason ?? null,
        announcedAt: att?.announced_at ?? null,
        actualStatus: att?.actual_status ?? null,
      };
    })
    .filter((r): r is RosterEntry => r !== null)
    .sort((a, b) => {
      if (a.jerseyNumber !== null && b.jerseyNumber !== null) {
        return a.jerseyNumber - b.jerseyNumber;
      }
      if (a.jerseyNumber !== null) return -1;
      if (b.jerseyNumber !== null) return 1;
      return a.fullName.localeCompare(b.fullName);
    });

  // Tests physiques : indicateurs du club + tests rattachés à la séance +
  // résultats déjà saisis pour cette séance (préremplissage).
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
  const testPlayers = roster.map((r) => ({
    playerId: r.playerId,
    fullName: r.fullName,
    jerseyNumber: r.jerseyNumber,
  }));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/${locale}/planner/${teamId}/sessions/${sessionId}/preparation`}
          className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("backToPreparation")}
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")} — {team.name}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {formatDate(session.date as string, currentLocale)}
          {session.start_time && ` · ${(session.start_time as string).slice(0, 5)}`}
          {session.theme && ` · ${session.theme}`}
        </p>
      </div>

      <Card>
        <AttendanceRoster
          sessionId={sessionId}
          teamId={teamId}
          deadlineHours={(session.rsvp_deadline_hours as number | null) ?? 24}
          roster={roster}
        />
      </Card>

      {physicalMetrics.length > 0 || attachedTestIds.length > 0 ? (
        <Card>
          <SessionPhysicalTests
            locale={locale}
            teamId={teamId}
            sessionId={sessionId}
            players={testPlayers}
            metrics={physicalMetrics}
            attachedIds={attachedTestIds}
            results={testResults}
            canRecord={canRecordPhysical}
          />
        </Card>
      ) : null}
    </div>
  );
}
