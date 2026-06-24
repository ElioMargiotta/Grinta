"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight, ClipboardCheck, Dumbbell, MapPin, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DASHBOARD_TEAM_COOKIE } from "@/lib/dashboard/teamCookie";
import type { WeekMatch, WeekOverview, WeekSession } from "@/lib/dashboard/week";

type DayBucket = { ymd: string; matches: WeekMatch[]; sessions: WeekSession[] };

function ymdFromIso(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const [ys, ms, ds] = start.split("-").map(Number);
  const cur = new Date(ys, ms - 1, ds);
  const [ye, me, de] = end.split("-").map(Number);
  const last = new Date(ye, me - 1, de);
  while (cur <= last) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const matchHref = (m: { teamId: string; id: string }) => `/planner/${m.teamId}/match/${m.id}`;
// Un entraînement s'ouvre sur sa préparation ; une éval physique sur ses tests.
const sessionHref = (s: WeekSession) =>
  s.kind === "physical_eval"
    ? `/planner/${s.teamId}/sessions/${s.id}/test`
    : `/planner/${s.teamId}/sessions/${s.id}/preparation`;

export function WeekPanel({
  overview,
  clubId,
  initialTeam,
}: {
  overview: WeekOverview;
  clubId: string;
  initialTeam: string;
}) {
  const t = useTranslations("dashboard.week");
  const locale = useLocale();
  // `initialTeam` vient du cookie lu côté serveur (cf. DASHBOARD_TEAM_COOKIE) :
  // le rendu initial est déjà correct, pas de flash ni d'effet de montage.
  const [team, setTeam] = useState<string>(initialTeam);

  // Mémorise le filtre entre les visites via un cookie scopé au club, pour ne
  // pas réappliquer l'équipe d'un autre club. Best-effort côté client.
  const selectTeam = (value: string) => {
    setTeam(value);
    document.cookie = `${DASHBOARD_TEAM_COOKIE}=${encodeURIComponent(`${clubId}:${value}`)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  };

  const multipleTeams = overview.teams.length > 1;
  const visibleTeam = team !== "all" && overview.teams.some((tm) => tm.id === team) ? team : "all";
  const plannerHref = visibleTeam === "all" ? "/planner" : `/planner/${visibleTeam}`;

  const matches = useMemo(
    () => overview.matches.filter((m) => visibleTeam === "all" || m.teamId === visibleTeam),
    [overview.matches, visibleTeam],
  );
  const sessions = useMemo(
    () => overview.sessions.filter((s) => visibleTeam === "all" || s.teamId === visibleTeam),
    [overview.sessions, visibleTeam],
  );
  const next =
    visibleTeam === "all" ? overview.nextMatch : overview.nextByTeam[visibleTeam] ?? null;

  const buckets = new Map<string, DayBucket>();
  for (const ymd of eachDay(overview.weekStart, overview.weekEnd)) {
    buckets.set(ymd, { ymd, matches: [], sessions: [] });
  }
  for (const m of matches) buckets.get(ymdFromIso(m.startsAt))?.matches.push(m);
  for (const s of sessions) buckets.get(s.date)?.sessions.push(s);

  const todayYmd = ymdFromIso(new Date().toISOString());
  const activeDays = [...buckets.values()].filter(
    (b) => b.matches.length > 0 || b.sessions.length > 0,
  );

  const dayLabel = (ymd: string) => {
    const [y, mo, d] = ymd.split("-").map(Number);
    const date = new Date(y, mo - 1, d);
    return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short" }).format(date);
  };
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const mdLabel = (offset: number) => {
    if (offset <= 0) return t("today");
    if (offset === 1) return t("tomorrow");
    return t("inDays", { count: offset });
  };
  const matchLabel = (m: WeekMatch) =>
    m.opponent
      ? t(m.homeAway === "away" ? "vsAway" : "vsHome", { opponent: m.opponent })
      : t("matchGeneric");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h2>
        <Link
          href={plannerHref}
          className="text-sm font-medium text-[var(--club-primary)] underline-offset-2 hover:underline"
        >
          {t("openPlanner")}
        </Link>
      </div>

      {multipleTeams && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <TeamPill active={visibleTeam === "all"} onClick={() => selectTeam("all")}>
            {t("allTeams")}
          </TeamPill>
          {overview.teams.map((tm) => (
            <TeamPill key={tm.id} active={visibleTeam === tm.id} onClick={() => selectTeam(tm.id)}>
              {tm.name}
            </TeamPill>
          ))}
        </div>
      )}

      {next && (
        <Link
          href={matchHref(next)}
          className="group flex items-center justify-between gap-4 rounded-2xl border border-[var(--club-line)] bg-gradient-to-br from-[var(--club-primary)]/[0.08] via-white to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:via-zinc-900 dark:to-zinc-900"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--club-primary)] text-[var(--club-primary-foreground)]">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                {t("nextMatch")} · {next.teamName}
              </div>
              <div className="mt-0.5 truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {matchLabel(next)}
              </div>
              <div className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {dayLabel(ymdFromIso(next.startsAt))} · {fmtTime(next.startsAt)}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="rounded-full bg-[var(--club-primary)]/10 px-3 py-1.5 text-sm font-semibold text-[var(--club-primary)]">
              {mdLabel(next.dayOffset)}
            </span>
            <ChevronRight className="h-4 w-4 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--club-primary)]" />
          </div>
        </Link>
      )}

      {activeDays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--club-line)] bg-white/60 p-8 text-center text-sm text-zinc-500 dark:bg-zinc-900/40 dark:text-zinc-400">
          {t("empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--club-line)] bg-white shadow-sm dark:bg-zinc-900">
          {activeDays.map((b, i) => {
            const isToday = b.ymd === todayYmd;
            return (
              <div
                key={b.ymd}
                className={`flex flex-col gap-2 p-4 sm:flex-row sm:gap-4 ${i > 0 ? "border-t border-[var(--club-line)]" : ""}`}
              >
                <div className="flex w-full shrink-0 items-center gap-2 sm:w-40">
                  <span
                    className={`text-sm font-semibold capitalize ${isToday ? "text-[var(--club-primary)]" : "text-zinc-900 dark:text-zinc-100"}`}
                  >
                    {dayLabel(b.ymd)}
                  </span>
                  {isToday && (
                    <span className="rounded-full bg-[var(--club-primary)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--club-primary)]">
                      {t("todayTag")}
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {b.matches.map((m) => (
                    <Link
                      key={m.id}
                      href={matchHref(m)}
                      className="group -mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    >
                      <Trophy className="h-4 w-4 shrink-0 text-[var(--club-primary)]" />
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {matchLabel(m)}
                      </span>
                      <span className="text-zinc-400">·</span>
                      <span className="text-zinc-500 dark:text-zinc-400">{fmtTime(m.startsAt)}</span>
                      {visibleTeam === "all" && (
                        <span className="truncate text-xs text-zinc-400">— {m.teamName}</span>
                      )}
                      {m.archived && m.homeScore !== null && m.awayScore !== null ? (
                        <span className="ml-auto rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {m.homeScore}–{m.awayScore}
                        </span>
                      ) : m.location ? (
                        <span className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-400">
                          <MapPin className="h-3 w-3" />
                          <span className="max-w-[10rem] truncate">{m.location}</span>
                        </span>
                      ) : (
                        <span className="ml-auto" />
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500 dark:group-hover:text-zinc-300" />
                    </Link>
                  ))}
                  {b.sessions
                    .filter((s) => s.kind === "training")
                    .map((s) => (
                      <Link
                        key={s.id}
                        href={sessionHref(s)}
                        className="group -mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      >
                        <Dumbbell className="h-4 w-4 shrink-0 text-zinc-400" />
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {s.theme || t("sessionGeneric")}
                        </span>
                        {s.startTime && (
                          <>
                            <span className="text-zinc-400">·</span>
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {s.startTime.slice(0, 5)}
                            </span>
                          </>
                        )}
                        {visibleTeam === "all" && (
                          <span className="truncate text-xs text-zinc-400">— {s.teamName}</span>
                        )}
                        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500 dark:group-hover:text-zinc-300" />
                      </Link>
                    ))}
                  {b.sessions
                    .filter((s) => s.kind === "physical_eval")
                    .map((s) => (
                      <Link
                        key={s.id}
                        href={sessionHref(s)}
                        className="group -mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30"
                      >
                        <ClipboardCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {s.theme || t("evalGeneric")}
                        </span>
                        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          {t("evalTag")}
                        </span>
                        {s.startTime && (
                          <>
                            <span className="text-zinc-400">·</span>
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {s.startTime.slice(0, 5)}
                            </span>
                          </>
                        )}
                        {visibleTeam === "all" && (
                          <span className="truncate text-xs text-zinc-400">— {s.teamName}</span>
                        )}
                        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
                      </Link>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <CalendarDays className="h-3.5 w-3.5" />
        {t("weekRange", { start: dayLabel(overview.weekStart), end: dayLabel(overview.weekEnd) })}
      </div>
    </section>
  );
}

function TeamPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-transparent bg-[var(--club-primary)] text-[var(--club-primary-foreground)]"
          : "border-[var(--club-line)] bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
