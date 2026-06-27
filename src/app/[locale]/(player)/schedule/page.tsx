import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { AttendanceRSVP } from "@/components/player/AttendanceRSVP";
import { MatchRSVP } from "@/components/player/MatchRSVP";
import { requirePersona } from "@/lib/auth/getUser";
import { getLinkedPlayers, resolveActivePlayer } from "@/lib/player/profiles";

type MatchCallupRow = {
  match_id: string;
  starts_at: string;
  team_name: string | null;
  summary: string | null;
  opponent: string | null;
  location: string | null;
  kind: string | null;
  home_away: string | null;
  availability: "available" | "unavailable" | null;
  availability_reason: string | null;
};

function formatDateTime(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type SessionRow = {
  id: string;
  team_id: string | null;
  date: string;
  start_time: string | null;
  duration_minutes: number | null;
  theme: string | null;
  rsvp_deadline_hours: number | null;
  teams: { name: string } | null;
};

type AttendanceRow = {
  session_id: string;
  announced_status: "present" | "absent" | null;
  announced_reason: string | null;
};

function formatDate(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function deadlinePassed(session: SessionRow): boolean {
  const startIso = `${session.date}T${session.start_time ?? "00:00"}:00`;
  const start = new Date(startIso).getTime();
  const hours = session.rsvp_deadline_hours ?? 24;
  return Date.now() > start - hours * 3600_000;
}

export default async function PlayerSchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, persona } = await requirePersona(locale, "player");
  const t = await getTranslations("playerSchedule");
  const currentLocale = await getLocale();
  const activePlayer = await resolveActivePlayer(
    await getLinkedPlayers(),
    persona.activeProfile === "parent" ? "guardian" : "self",
  );

  if (!activePlayer) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
        </Card>
      </div>
    );
  }

  const { data: assignments } = await supabase
    .from("player_team_assignments")
    .select("team_id")
    .eq("player_id", activePlayer.playerId);
  const teamIds = Array.from(new Set((assignments ?? []).map((a) => a.team_id as string)));

  if (teamIds.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
        </Card>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: sessionData } = await supabase
    .from("sessions")
    .select(
      `id, team_id, date, start_time, duration_minutes, theme,
       rsvp_deadline_hours, teams!inner(name)`,
    )
    .in("team_id", teamIds)
    .gte("date", today)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .limit(50)
    .returns<SessionRow[]>();

  const sessions = sessionData ?? [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: attendanceData } = sessionIds.length
    ? await supabase
        .from("session_attendances")
        .select("session_id, announced_status, announced_reason")
        .eq("player_id", activePlayer.playerId)
        .in("session_id", sessionIds)
        .returns<AttendanceRow[]>()
    : { data: [] as AttendanceRow[] };

  const attendanceBySession = new Map(
    (attendanceData ?? []).map((a) => [a.session_id, a]),
  );

  // Convocations match à venir pour la fiche active. La RPC vérifie self ou parent.
  const { data: matchData } = await supabase.rpc(
    "player_match_callups_for_player",
    { p_player_id: activePlayer.playerId },
  );
  const matches = (matchData ?? []) as MatchCallupRow[];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {t("title")}
      </h1>

      {matches.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("matchesTitle")}
          </h2>
          {matches.map((m) => {
            const label =
              m.summary ?? m.opponent ?? t("matchUntitled");
            return (
              <Card key={m.match_id}>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[var(--club-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--club-primary)]">
                          {t("matchBadge")}
                        </span>
                        <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                          {label}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        {m.team_name ?? "—"}
                        {m.location ? ` · ${m.location}` : ""}
                      </div>
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-300">
                      {formatDateTime(m.starts_at, currentLocale)}
                    </div>
                  </div>
                  <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    <MatchRSVP
                      matchId={m.match_id}
                      playerId={activePlayer.playerId}
                      initialStatus={m.availability}
                      initialReason={m.availability_reason}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("emptyUpcoming")}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => {
            const attendance = attendanceBySession.get(s.id) ?? null;
            return (
              <Card key={s.id}>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {s.theme ?? t("untitled")}
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        {s.teams?.name ?? "—"}
                      </div>
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-300">
                      <div>{formatDate(s.date, currentLocale)}</div>
                      {s.start_time && (
                        <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                          {s.start_time.slice(0, 5)}
                          {s.duration_minutes ? ` · ${s.duration_minutes}'` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    <AttendanceRSVP
                      sessionId={s.id}
                      playerId={activePlayer.playerId}
                      deadlinePassed={deadlinePassed(s)}
                      initialStatus={attendance?.announced_status ?? null}
                      initialReason={attendance?.announced_reason ?? null}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
