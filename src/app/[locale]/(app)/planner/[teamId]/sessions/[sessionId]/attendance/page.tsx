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
  StaffAttendanceRoster,
  type StaffEntry,
} from "@/components/planner/StaffAttendanceRoster";
import { requireMembership } from "@/lib/auth/getUser";
import { currentSeasonLabel } from "@/lib/planner/seasons";
import {
  activeUnavailability,
  type Unavailability,
  type UnavailabilityKind,
} from "@/lib/availability/unavailability";

type UnavailabilityDbRow = {
  player_id: string;
  kind: UnavailabilityKind;
  reason: string | null;
  start_date: string;
  end_date: string | null;
};

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
  const { supabase } = await requireMembership(locale);
  const t = await getTranslations("attendance.coach");
  const currentLocale = await getLocale();

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

  // Encadrement (moniteurs/staff) de l'équipe + leur pointage de la séance.
  // `list_team_staff` (SECURITY DEFINER) contourne la RLS de club_memberships
  // pour qu'un coach d'équipe voie aussi ses moniteurs (export BDNS #59).
  const [{ data: staffRaw }, { data: staffAttRaw }] = await Promise.all([
    supabase.rpc("list_team_staff", { p_team_id: teamId }),
    supabase
      .from("session_staff_attendances")
      .select("membership_id, actual_status")
      .eq("session_id", sessionId)
      .returns<{ membership_id: string; actual_status: "present" | "absent" | null }[]>(),
  ]);
  const staffAttByMember = new Map(
    (staffAttRaw ?? []).map((a) => [a.membership_id, a.actual_status]),
  );
  const staffList = (staffRaw ?? []) as {
    membership_id: string;
    user_id: string;
    full_name: string | null;
    js_number: string | null;
  }[];
  const staff: StaffEntry[] = staffList.map((s) => ({
    membershipId: s.membership_id,
    fullName: (s.full_name ?? "").trim(),
    jsNumber: s.js_number,
    actualStatus: staffAttByMember.get(s.membership_id) ?? null,
  }));

  // Indisponibilités (médical/discipline) couvrant la date de la séance.
  const sessionDate = session.date as string;
  const rosterPlayerIds = assignments
    .map((a) => a.players?.id)
    .filter((id): id is string => Boolean(id));
  const { data: unavailRows } = rosterPlayerIds.length
    ? await supabase
        .from("player_unavailability")
        .select("player_id, kind, reason, start_date, end_date")
        .in("player_id", rosterPlayerIds)
        .lte("start_date", sessionDate)
        .or(`end_date.is.null,end_date.gte.${sessionDate}`)
        .returns<UnavailabilityDbRow[]>()
    : { data: [] as UnavailabilityDbRow[] };

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

  const roster: RosterEntry[] = assignments
    .map((a) => {
      const p = a.players;
      if (!p) return null;
      const att = attByPlayer.get(p.id);
      const active = activeUnavailability(unavailByPlayer.get(p.id) ?? [], sessionDate);
      return {
        playerId: p.id,
        fullName: `${p.first_name} ${p.last_name}`.trim(),
        jerseyNumber: p.jersey_number,
        announcedStatus: att?.announced_status ?? null,
        announcedReason: att?.announced_reason ?? null,
        announcedAt: att?.announced_at ?? null,
        actualStatus: att?.actual_status ?? null,
        unavailability: active
          ? { kind: active.kind, reason: active.reason }
          : null,
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

      <Card>
        <StaffAttendanceRoster
          sessionId={sessionId}
          teamId={teamId}
          staff={staff}
        />
      </Card>
    </div>
  );
}
