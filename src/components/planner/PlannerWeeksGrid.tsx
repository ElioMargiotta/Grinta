"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Macrocycle, Mesocycle } from "./PlannerTourView";
import { THEME_COLORS, type ThemeKey } from "./MicrocycleThemePicker";

const KNOWN_THEMES: ThemeKey[] = [
  "possede_ballon",
  "ne_possede_pas",
  "recupere",
  "perd",
  "recupere_perd",
  "decharge",
  "jeux_polysport",
];

function isKnownTheme(value: string | null): value is ThemeKey {
  return !!value && (KNOWN_THEMES as string[]).includes(value);
}

function formatPeriodWeek(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

type GridSession = {
  id: string;
  title: string;
  date: string;
  durationMinutes: number | null;
};

type MesoInfo = {
  id: string;
  name: string;
  kind: Mesocycle["kind"];
  color: string | null;
  weekCount: number;
  firstWeekNumber: number;
  lastWeekNumber: number;
};

type MicroLookup = {
  mesoId: string;
  weekNumber: number;
  theme: string | null;
  format: string | null;
};

type SessionType =
  | "tactical"
  | "physical"
  | "technical"
  | "recovery"
  | "setpiece"
  | "match";

const TYPE_ORDER: SessionType[] = [
  "tactical",
  "physical",
  "technical",
  "recovery",
  "setpiece",
  "match",
];

const TYPE_COLOR: Record<SessionType, string> = {
  tactical: "#2563eb",
  physical: "#dc2626",
  technical: "#0f7d3f",
  recovery: "#475569",
  setpiece: "#7c3aed",
  match: "#d97706",
};

const TYPE_BLOCK_CLASS: Record<SessionType, string> = {
  tactical:
    "bg-blue-50 border-l-blue-600 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100 dark:border-l-blue-500",
  physical:
    "bg-red-50 border-l-red-600 text-red-900 dark:bg-red-950/40 dark:text-red-100 dark:border-l-red-500",
  technical:
    "bg-emerald-50 border-l-emerald-700 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-l-emerald-500",
  recovery:
    "bg-slate-100 border-l-slate-500 text-slate-900 dark:bg-slate-900/60 dark:text-slate-100 dark:border-l-slate-400",
  setpiece:
    "bg-violet-50 border-l-violet-600 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100 dark:border-l-violet-500",
  match:
    "bg-amber-50 border-l-amber-600 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100 dark:border-l-amber-500",
};

const TYPE_KEYWORDS: { type: SessionType; words: string[] }[] = [
  { type: "match", words: ["match", "vs ", "v ", "game"] },
  { type: "recovery", words: ["recovery", "recover", "pool", "mobility", "regen"] },
  {
    type: "setpiece",
    words: ["set piece", "set-piece", "setpiece", "corner", "free kick", "fk"],
  },
  {
    type: "physical",
    words: [
      "speed",
      "power",
      "sprint",
      "endurance",
      "hiit",
      "agility",
      "plyo",
      "fitness",
      "conditioning",
      "strength",
    ],
  },
  {
    type: "technical",
    words: [
      "ball",
      "finish",
      "finishing",
      "crossing",
      "passing",
      "rondo",
      "combinations",
      "1v1",
      "dribble",
      "control",
    ],
  },
  {
    type: "tactical",
    words: [
      "tactic",
      "press",
      "build",
      "build-up",
      "shape",
      "transition",
      "block",
      "counter",
      "game model",
      "defending",
    ],
  },
];

function inferType(theme: string | null | undefined): SessionType {
  if (!theme) return "tactical";
  const t = theme.toLowerCase();
  for (const { type, words } of TYPE_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return type;
  }
  return "tactical";
}

const DAYS: ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];
const WEEKLY_LOAD_TARGET_MIN = 420;

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function weeksOfMonth(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const firstMonday = startOfWeek(firstOfMonth);
  const lastMonday = startOfWeek(lastOfMonth);
  const out: Date[] = [];
  for (
    let cursor = new Date(firstMonday);
    cursor <= lastMonday;
    cursor.setDate(cursor.getDate() + 7)
  ) {
    out.push(new Date(cursor));
  }
  return out;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function loadColor(pct: number): string {
  if (pct > 85) return "#dc2626";
  if (pct > 60) return "#f59e0b";
  return "#22c55e";
}

type EnrichedSession = GridSession & { type: SessionType };

export function PlannerWeeksGrid({
  teamId,
  sessions,
  macrocycles = [],
}: {
  teamId: string;
  sessions: GridSession[];
  macrocycles?: Macrocycle[];
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("planner.weeks");
  const tTour = useTranslations("planner.tour");
  const tTheme = useTranslations("planner.theme");
  const today = ymd(new Date());

  const { microByStart, mesoById } = useMemo(() => {
    const microByStart = new Map<string, MicroLookup>();
    const mesoById = new Map<string, MesoInfo>();
    for (const macro of macrocycles) {
      for (const meso of macro.mesocycles) {
        const weekNums = meso.microcycles.map((mi) => mi.week_number);
        mesoById.set(meso.id, {
          id: meso.id,
          name: meso.name,
          kind: meso.kind,
          color: meso.color,
          weekCount: meso.microcycles.length,
          firstWeekNumber: weekNums.length ? Math.min(...weekNums) : 0,
          lastWeekNumber: weekNums.length ? Math.max(...weekNums) : 0,
        });
        for (const micro of meso.microcycles) {
          microByStart.set(micro.start_date, {
            mesoId: meso.id,
            weekNumber: micro.week_number,
            theme: micro.theme,
            format: micro.format,
          });
        }
      }
    }
    return { microByStart, mesoById };
  }, [macrocycles]);

  const firstMicroDate = useMemo(() => {
    const dates = [...microByStart.keys()].sort();
    return dates[0] ?? null;
  }, [microByStart]);

  const [currentMonth, setCurrentMonth] = useState<{ year: number; month: number }>(
    () => {
      const todayDate = new Date();
      if (firstMicroDate) {
        const [y, m, d] = firstMicroDate.split("-").map(Number);
        const firstDate = new Date(y, m - 1, d);
        const lastKey = [...microByStart.keys()].sort().at(-1);
        if (lastKey) {
          const [ly, lm, ld] = lastKey.split("-").map(Number);
          const lastDate = new Date(ly, lm - 1, ld);
          if (todayDate < firstDate || todayDate > lastDate) {
            return { year: firstDate.getFullYear(), month: firstDate.getMonth() };
          }
        }
      }
      return { year: todayDate.getFullYear(), month: todayDate.getMonth() };
    },
  );
  const [activeTypes, setActiveTypes] = useState<Set<SessionType>>(
    () => new Set(TYPE_ORDER)
  );

  const enriched = useMemo<EnrichedSession[]>(
    () => sessions.map((s) => ({ ...s, type: inferType(s.title) })),
    [sessions]
  );

  const byDate = useMemo(() => {
    const m = new Map<string, EnrichedSession[]>();
    for (const s of enriched) {
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    }
    return m;
  }, [enriched]);

  const weeks = useMemo(
    () => weeksOfMonth(currentMonth.year, currentMonth.month),
    [currentMonth],
  );

  const stats = useMemo(() => {
    let totalSessions = 0;
    let totalMin = 0;
    const byType = new Map<SessionType, number>();
    for (const w of weeks) {
      for (let i = 0; i < 7; i++) {
        const list = byDate.get(ymd(addDays(w, i))) ?? [];
        for (const s of list) {
          if (!activeTypes.has(s.type)) continue;
          totalSessions++;
          const min = s.durationMinutes ?? 0;
          totalMin += min;
          byType.set(s.type, (byType.get(s.type) ?? 0) + min);
        }
      }
    }
    return { totalSessions, totalMin, byType };
  }, [weeks, byDate, activeTypes]);

  function toggleType(type: SessionType) {
    setActiveTypes((prev) => {
      const n = new Set(prev);
      if (n.has(type)) n.delete(type);
      else n.add(type);
      return n;
    });
  }

  const monthLabel = new Date(
    currentMonth.year,
    currentMonth.month,
    1,
  ).toLocaleDateString(locale, { month: "long", year: "numeric" });

  const shiftMonth = (delta: number) =>
    setCurrentMonth((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const jumpToToday = () => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
  };

  const totalHours = Math.floor(stats.totalMin / 60);
  const totalRem = stats.totalMin % 60;
  const avgPerWeekHours = Math.round((stats.totalMin / weeks.length / 60) * 10) / 10;
  const sortedByType = [...stats.byType.entries()].sort((a, b) => b[1] - a[1]);

  const renderWeekRow = (
    weekStart: Date,
    _wi: number,
    micro: MicroLookup | undefined
  ): React.ReactNode => {
    const weekEnd = addDays(weekStart, 6);
    const isCurrentWeek = ymd(weekStart) <= today && today <= ymd(weekEnd);

    if (!micro) {
      return (
        <div
          key={ymd(weekStart)}
          className="col-span-full flex items-center gap-3 border-b border-dashed border-zinc-300 px-4 py-2 text-[11px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
        >
          <span className="h-px flex-1 border-t border-dashed border-zinc-200 dark:border-zinc-800" />
          <span className="tabular-nums">
            {weekStart.toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
            })}
            {" – "}
            {weekEnd.toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="h-px flex-1 border-t border-dashed border-zinc-200 dark:border-zinc-800" />
        </div>
      );
    }

    const weekLabelText = t("weekN", {
      n: formatPeriodWeek(micro.weekNumber),
    });
    const themeKey = micro && isKnownTheme(micro.theme) ? micro.theme : null;
    const themeColors = themeKey ? THEME_COLORS[themeKey] : null;
    const themeLabel = themeKey
      ? tTheme(`option.${themeKey}`)
      : micro?.theme || null;
    const formatKey = micro?.format ?? null;
    const formatLabel =
      formatKey === "1v1_2v2" || formatKey === "3v3_5v5"
        ? tTheme(`formatOption.${formatKey}`)
        : formatKey;

    let weekTotal = 0;
    let sessionCount = 0;
    const weekByType = new Map<SessionType, number>();
    for (let i = 0; i < 7; i++) {
      const list = byDate.get(ymd(addDays(weekStart, i))) ?? [];
      for (const s of list) {
        if (!activeTypes.has(s.type)) continue;
        const min = s.durationMinutes ?? 0;
        weekTotal += min;
        sessionCount++;
        weekByType.set(s.type, (weekByType.get(s.type) ?? 0) + min);
      }
    }

    const loadPct = Math.min(
      100,
      Math.round((weekTotal / WEEKLY_LOAD_TARGET_MIN) * 100)
    );

    const tagText = isCurrentWeek
      ? t("tag.current")
      : loadPct > 85
        ? t("tag.high")
        : loadPct < 40
          ? t("tag.light")
          : t("tag.normal");
    const tagClass = isCurrentWeek
      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800"
      : loadPct > 85
        ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800"
        : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";

    return (
      <div key={ymd(weekStart)} className="contents">
        <div className="flex flex-col justify-between gap-2 border-b border-r border-zinc-200 bg-zinc-50/70 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {weekLabelText}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tagClass}`}
              >
                {tagText}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {weekStart.toLocaleDateString(locale, {
                month: "short",
                day: "numeric",
              })}
              {" – "}
              {weekEnd.toLocaleDateString(locale, {
                month: "short",
                day: "numeric",
              })}
            </div>
            {themeLabel ? (
              <div
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border-l-2 bg-white/60 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
                style={{ borderLeftColor: themeColors?.dot ?? "#cbd5e1" }}
                title={themeLabel}
              >
                <span className="line-clamp-1">{themeLabel}</span>
              </div>
            ) : null}
            {formatLabel ? (
              <div className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                {formatLabel}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${loadPct}%`,
                  background: loadColor(loadPct),
                }}
              />
            </div>
            <span className="min-w-[30px] text-right font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
              {loadPct}%
            </span>
          </div>
        </div>

        {DAYS.map((_, di) => {
          const cellDate = addDays(weekStart, di);
          const dateStr = ymd(cellDate);
          const list = (byDate.get(dateStr) ?? []).filter((s) =>
            activeTypes.has(s.type)
          );
          const isToday = dateStr === today;
          const isWeekend = di >= 5;

          return (
            <div
              key={dateStr}
              role="button"
              tabIndex={0}
              onClick={() =>
                router.push({
                  pathname: `/planner/${teamId}/sessions/new`,
                  query: { date: dateStr },
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push({
                    pathname: `/planner/${teamId}/sessions/new`,
                    query: { date: dateStr },
                  });
                }
              }}
              className={`group relative flex min-h-[96px] cursor-pointer flex-col gap-1 border-b border-r border-zinc-200 p-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400 dark:border-zinc-800 ${
                isToday
                  ? "bg-amber-50/60 dark:bg-amber-950/20"
                  : isWeekend
                    ? "bg-zinc-50/70 dark:bg-zinc-950/40"
                    : "bg-white dark:bg-zinc-900"
              } hover:bg-zinc-50 dark:hover:bg-zinc-800/50`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] tabular-nums ${
                    isToday
                      ? "rounded bg-zinc-900 px-1 py-px font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {cellDate.getDate()}
                </span>
              </div>
              {list.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/planner/${teamId}/sessions/${s.id}`);
                  }}
                  title={s.title}
                  className={`flex w-full flex-col gap-0.5 rounded border-l-[3px] px-1.5 py-1 text-left transition-transform hover:-translate-y-px hover:shadow-sm ${
                    TYPE_BLOCK_CLASS[s.type]
                  }`}
                >
                  <span className="truncate text-[11px] font-semibold leading-tight">
                    {s.type === "match" ? "⚽ " : ""}
                    {s.title}
                  </span>
                  {s.durationMinutes ? (
                    <span className="flex items-center gap-1 text-[10px] tabular-nums opacity-75">
                      <svg
                        width="9"
                        height="9"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {s.durationMinutes}m
                    </span>
                  ) : null}
                </button>
              ))}
              {list.length === 0 ? (
                <span className="pointer-events-none mt-auto text-[11px] text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-500">
                  + {t("addSession")}
                </span>
              ) : null}
            </div>
          );
        })}

        <div className="flex flex-col gap-2 border-b border-l border-zinc-200 bg-zinc-50/60 px-3 py-3 text-[11px] dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span>{t("sessions")}</span>
            <strong className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {sessionCount}
            </strong>
          </div>
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span>{t("totalTime")}</span>
            <strong className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {Math.floor(weekTotal / 60)}h {weekTotal % 60}m
            </strong>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            {weekTotal > 0
              ? [...weekByType.entries()].map(([type, min]) => (
                  <span
                    key={type}
                    title={`${t(`type.${type}`)}: ${min}m`}
                    className="block h-full"
                    style={{
                      width: `${(min / weekTotal) * 100}%`,
                      background: TYPE_COLOR[type],
                    }}
                  />
                ))
              : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label={t("prev")}
          >
            ‹
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold tracking-tight capitalize text-zinc-900 dark:text-zinc-100">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label={t("next")}
          >
            ›
          </button>
          <button
            type="button"
            onClick={jumpToToday}
            className="ml-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {t("today")}
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {TYPE_ORDER.map((type) => {
            const on = activeTypes.has(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors ${
                  on
                    ? "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    : "border-zinc-200 bg-white text-zinc-400 opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: TYPE_COLOR[type] }}
                />
                {t(`type.${type}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid min-w-[1080px] grid-cols-[200px_repeat(7,minmax(0,1fr))_200px]">
          <div className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            {t("week")}
          </div>
          {DAYS.map((d) => (
            <div
              key={d}
              className="border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
            >
              {t(`day.${d}`)}
            </div>
          ))}
          <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            {t("summary")}
          </div>

          {(() => {
            const rows: React.ReactNode[] = [];
            let lastMesoId: string | null = null;
            weeks.forEach((weekStart, wi) => {
              const startStr = ymd(weekStart);
              const micro = microByStart.get(startStr);
              const meso = micro ? mesoById.get(micro.mesoId) : null;
              if (meso && meso.id !== lastMesoId) {
                rows.push(
                  <div
                    key={`meso-${meso.id}-${wi}`}
                    className="col-span-full grid grid-cols-[200px_1fr_200px] border-b border-zinc-900 bg-zinc-900 text-[11px] font-semibold uppercase tracking-wider text-zinc-100 dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <div className="flex items-center gap-2 px-3.5 py-1.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: meso.color ?? "#86efac" }}
                      />
                      <span className="truncate">{meso.name}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 normal-case tracking-normal text-emerald-300">
                      <span className="opacity-70">
                        {tTour(`mesoKind.${meso.kind}`)}
                      </span>
                      <span className="opacity-40">·</span>
                      <span>
                        {t("weekN", { n: meso.firstWeekNumber })}
                        {" – "}
                        {t("weekN", { n: meso.lastWeekNumber })}
                      </span>
                    </div>
                    <div className="px-3 py-1.5 text-right normal-case tracking-normal text-zinc-400">
                      {tTour("weeksCount", { n: meso.weekCount })}
                    </div>
                  </div>
                );
              }
              lastMesoId = meso?.id ?? lastMesoId;
              rows.push(renderWeekRow(weekStart, wi, micro));
            });
            return rows;
          })()}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {t("sessions")}
          </span>
          <span className="text-lg font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
            {stats.totalSessions}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {t("totalTime")}
          </span>
          <span className="text-lg font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
            {totalHours}
            <span className="ml-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              h {totalRem}m
            </span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {t("avgPerWeek")}
          </span>
          <span className="text-lg font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
            {avgPerWeekHours}
            <span className="ml-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              h
            </span>
          </span>
        </div>
        <div className="flex max-w-[420px] flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {t("typeDistribution")}
          </span>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            {stats.totalMin > 0
              ? sortedByType.map(([type, min]) => (
                  <span
                    key={type}
                    title={`${t(`type.${type}`)}: ${min}m`}
                    className="block h-full"
                    style={{
                      width: `${(min / stats.totalMin) * 100}%`,
                      background: TYPE_COLOR[type],
                    }}
                  />
                ))
              : null}
          </div>
          <div className="flex flex-wrap gap-2.5 text-[10px] text-zinc-500 dark:text-zinc-400">
            {sortedByType.map(([type, min]) => (
              <span key={type} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: TYPE_COLOR[type] }}
                />
                {t(`type.${type}`)} {Math.round((min / stats.totalMin) * 100)}%
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
