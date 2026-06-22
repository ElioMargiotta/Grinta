import { Check, X, HeartPulse, Minus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDay } from "@/lib/contingent/week";
import {
  activeUnavailability,
  type Unavailability,
} from "@/lib/availability/unavailability";

export type BoardPlayer = {
  playerId: string;
  fullName: string;
  jerseyNumber: number | null;
  presenceRate: number | null;
};

export type BoardSession = {
  id: string;
  date: string;
  kind: string;
};

export type BoardAttendance = {
  player_id: string;
  session_id: string;
  announced_status: "present" | "absent" | null;
  actual_status: "present" | "absent" | null;
};

type CellState = "injured" | "present" | "absent" | "announced_present" | "announced_absent" | "none";

function cellFor(
  playerId: string,
  session: BoardSession,
  attendance: Map<string, BoardAttendance>,
  unavailByPlayer: Map<string, Unavailability[]>,
): CellState {
  const active = activeUnavailability(unavailByPlayer.get(playerId) ?? [], session.date);
  if (active) return "injured";
  const att = attendance.get(`${playerId}|${session.id}`);
  if (att?.actual_status === "present") return "present";
  if (att?.actual_status === "absent") return "absent";
  if (att?.announced_status === "present") return "announced_present";
  if (att?.announced_status === "absent") return "announced_absent";
  return "none";
}

function Cell({ state }: { state: CellState }) {
  const base = "mx-auto flex h-6 w-6 items-center justify-center rounded-full";
  switch (state) {
    case "injured":
      return (
        <span className={`${base} bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300`}>
          <HeartPulse className="h-3.5 w-3.5" />
        </span>
      );
    case "present":
      return (
        <span className={`${base} bg-emerald-600 text-white`}>
          <Check className="h-3.5 w-3.5" />
        </span>
      );
    case "absent":
      return (
        <span className={`${base} bg-red-600 text-white`}>
          <X className="h-3.5 w-3.5" />
        </span>
      );
    case "announced_present":
      return (
        <span className={`${base} bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30`}>
          <Check className="h-3.5 w-3.5" />
        </span>
      );
    case "announced_absent":
      return (
        <span className={`${base} bg-red-50 text-red-500 dark:bg-red-950/30`}>
          <X className="h-3.5 w-3.5" />
        </span>
      );
    default:
      return (
        <span className={`${base} text-zinc-300 dark:text-zinc-600`}>
          <Minus className="h-3.5 w-3.5" />
        </span>
      );
  }
}

export async function TeamAvailabilityBoard({
  teamId,
  players,
  sessions,
  attendances,
  unavailabilities,
}: {
  teamId: string;
  players: BoardPlayer[];
  sessions: BoardSession[];
  attendances: BoardAttendance[];
  unavailabilities: Unavailability[];
}) {
  const t = await getTranslations("availabilityBoard");

  const attendanceMap = new Map<string, BoardAttendance>();
  for (const a of attendances) attendanceMap.set(`${a.player_id}|${a.session_id}`, a);
  const unavailByPlayer = new Map<string, Unavailability[]>();
  for (const u of unavailabilities) {
    const arr = unavailByPlayer.get(u.playerId) ?? [];
    arr.push(u);
    unavailByPlayer.set(u.playerId, arr);
  }

  if (sessions.length === 0 || players.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--club-line)] p-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-900">
              <th className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                {t("player")}
              </th>
              {sessions.map((s) => (
                <th key={s.id} className="px-2 py-2 text-center">
                  <Link
                    href={
                      s.kind === "physical_eval"
                        ? `/planner/${teamId}/sessions/${s.id}/test`
                        : `/planner/${teamId}/sessions/${s.id}/attendance`
                    }
                    className="flex flex-col items-center gap-0.5 text-[11px] font-mono font-medium text-zinc-500 hover:text-[var(--club-primary)]"
                  >
                    <span>{formatDay(s.date)}</span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        s.kind === "physical_eval"
                          ? "bg-[var(--club-primary)]"
                          : "bg-zinc-300 dark:bg-zinc-600"
                      }`}
                    />
                  </Link>
                </th>
              ))}
              <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                {t("presence")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {players.map((p) => (
              <tr key={p.playerId} className="bg-white dark:bg-zinc-950">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-zinc-950">
                  <Link
                    href={`/contingent/${p.playerId}`}
                    className="flex items-center gap-2 font-medium text-zinc-900 hover:text-[var(--club-primary)] dark:text-zinc-100"
                  >
                    {p.jerseyNumber !== null ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--club-primary-soft)] text-[11px] font-semibold text-[var(--club-primary)]">
                        {p.jerseyNumber}
                      </span>
                    ) : null}
                    {p.fullName}
                  </Link>
                </td>
                {sessions.map((s) => (
                  <td key={s.id} className="px-2 py-1.5">
                    <Cell state={cellFor(p.playerId, s, attendanceMap, unavailByPlayer)} />
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums text-zinc-600 dark:text-zinc-300">
                  {p.presenceRate === null ? "—" : `${Math.round(p.presenceRate * 100)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1"><Cell state="present" /> {t("legend.present")}</span>
        <span className="flex items-center gap-1"><Cell state="absent" /> {t("legend.absent")}</span>
        <span className="flex items-center gap-1"><Cell state="announced_present" /> {t("legend.announced")}</span>
        <span className="flex items-center gap-1"><Cell state="injured" /> {t("legend.injured")}</span>
        <span className="flex items-center gap-1"><Cell state="none" /> {t("legend.none")}</span>
      </div>
    </div>
  );
}
