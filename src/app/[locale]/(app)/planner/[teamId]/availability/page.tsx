import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireMembership } from "@/lib/auth/getUser";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";
import { getPlayersOverview } from "@/lib/contingent/playerStats";
import type { Unavailability, UnavailabilityKind } from "@/lib/availability/unavailability";
import {
  TeamAvailabilityBoard,
  type BoardAttendance,
  type BoardPlayer,
  type BoardSession,
} from "@/components/planner/TeamAvailabilityBoard";

const UPCOMING_LIMIT = 8;

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

export default async function TeamAvailabilityPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  setRequestLocale(locale);
  const { supabase, membership } = await requireMembership(locale);
  const t = await getTranslations("availabilityBoard");
  const season = await resolveCurrentSeasonLabel();
  const today = new Date().toISOString().slice(0, 10);

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, club_id")
    .eq("id", teamId)
    .single();
  if (!team || team.club_id !== membership.club_id) notFound();

  const [{ data: assignmentRows }, { data: sessionRows }] = await Promise.all([
    supabase
      .from("player_team_assignments")
      .select("player_id, players (id, first_name, last_name, jersey_number)")
      .eq("team_id", teamId)
      .eq("season", season),
    supabase
      .from("sessions")
      .select("id, date, kind")
      .eq("team_id", teamId)
      .gte("date", today)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: true })
      .limit(UPCOMING_LIMIT)
      .returns<BoardSession[]>(),
  ]);

  const assignments = (assignmentRows ?? []) as unknown as AssignmentRow[];
  const playerIds = assignments
    .map((a) => a.players?.id)
    .filter((id): id is string => Boolean(id));
  const sessions = sessionRows ?? [];
  const sessionIds = sessions.map((s) => s.id);
  const lastDate = sessions.length ? sessions[sessions.length - 1].date : today;

  const [{ data: attendanceRows }, { data: unavailRows }, overview] = await Promise.all([
    sessionIds.length
      ? supabase
          .from("session_attendances")
          .select("player_id, session_id, announced_status, actual_status")
          .in("session_id", sessionIds)
          .returns<BoardAttendance[]>()
      : Promise.resolve({ data: [] as BoardAttendance[] }),
    playerIds.length
      ? supabase
          .from("player_unavailability")
          .select("player_id, kind, reason, start_date, end_date")
          .in("player_id", playerIds)
          .lte("start_date", lastDate)
          .or(`end_date.is.null,end_date.gte.${today}`)
          .returns<UnavailabilityDbRow[]>()
      : Promise.resolve({ data: [] as UnavailabilityDbRow[] }),
    getPlayersOverview(supabase, { season, playerIds }),
  ]);

  const players: BoardPlayer[] = assignments
    .map((a) => {
      const p = a.players;
      if (!p) return null;
      return {
        playerId: p.id,
        fullName: `${p.first_name} ${p.last_name}`.trim(),
        jerseyNumber: p.jersey_number,
        presenceRate: overview.get(p.id)?.presenceRate ?? null,
      };
    })
    .filter((p): p is BoardPlayer => p !== null)
    .sort((a, b) => {
      if (a.jerseyNumber !== null && b.jerseyNumber !== null) {
        return a.jerseyNumber - b.jerseyNumber;
      }
      if (a.jerseyNumber !== null) return -1;
      if (b.jerseyNumber !== null) return 1;
      return a.fullName.localeCompare(b.fullName);
    });

  const unavailabilities: Unavailability[] = (unavailRows ?? []).map((u) => ({
    id: "",
    playerId: u.player_id,
    kind: u.kind,
    reason: u.reason,
    startDate: u.start_date,
    endDate: u.end_date,
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/planner/${teamId}`}
          className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")} — {team.name}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
      </div>

      <TeamAvailabilityBoard
        teamId={teamId}
        players={players}
        sessions={sessions}
        attendances={attendanceRows ?? []}
        unavailabilities={unavailabilities}
      />
    </div>
  );
}
