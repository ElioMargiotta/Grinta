"use client";

import { useMemo, useState, useTransition } from "react";
import type { DragEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Activity, Copy, Trash2, Users, X } from "lucide-react";
import type { Macrocycle, Mesocycle } from "./PlannerTourView";
import type { EvalMetric, PlannerEval } from "./PlannerCalendar";
import {
  MicrocycleThemePicker,
  THEME_COLORS,
  type ThemeKey,
} from "./MicrocycleThemePicker";
import {
  createPhysicalTestAction,
  createSessionForSlotAction,
  deletePlannerSessionAction,
  duplicatePlannerSessionAction,
  movePlannerSessionAction,
} from "@/app/[locale]/(app)/planner/actions";
import { clearSeasonAction } from "@/app/[locale]/(app)/planner/[teamId]/season-actions";
import type { FocusFamily } from "@/components/sheet/types";
import { isStructuringKind } from "@/lib/planner/season";

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
  start: string | null;
  durationMinutes: number | null;
  focusFamilies?: FocusFamily[];
};

type Slot = "morning" | "afternoon";

function slotOf(start: string | null): Slot {
  if (!start) return "morning";
  const m = /T(\d{2}):/.exec(start);
  if (!m) return "morning";
  return Number(m[1]) < 12 ? "morning" : "afternoon";
}

function timeOf(start: string | null): string | null {
  if (!start) return null;
  const m = /T(\d{2}:\d{2})/.exec(start);
  return m ? m[1] : null;
}

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
  id: string;
  mesoId: string;
  weekNumber: number;
  theme: string | null;
  format: string | null;
  notes: string | null;
};

type SessionType =
  | "tactical"
  | "physical"
  | "technical"
  | "mental"
  | "recovery"
  | "setpiece"
  | "match";

const TYPE_ORDER: SessionType[] = [
  "tactical",
  "physical",
  "technical",
  "mental",
  "recovery",
  "setpiece",
  "match",
];

const TYPE_COLOR: Record<SessionType, string> = {
  tactical: "#2f5fba",
  physical: "#c94a4a",
  technical: "#2d8f5f",
  mental: "#7a5bb8",
  recovery: "#64748b",
  setpiece: "#7a5bb8",
  match: "#c47a24",
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

const FOCUS_TO_TYPE: Record<FocusFamily, SessionType> = {
  TA: "tactical",
  TE: "technical",
  PE: "physical",
  AT: "mental",
};

function typesFromFocusFamilies(families: FocusFamily[] | undefined): SessionType[] {
  const types = (families ?? []).map((f) => FOCUS_TO_TYPE[f]).filter(Boolean);
  return [...new Set(types)];
}

function sessionTypes(session: GridSession): SessionType[] {
  const fromFocus = typesFromFocusFamilies(session.focusFamilies);
  return fromFocus.length ? fromFocus : [inferType(session.title)];
}

function typeBar(types: SessionType[]): string {
  const colors = types.map((type) => TYPE_COLOR[type]);
  if (colors.length <= 1) return colors[0] ?? TYPE_COLOR.tactical;
  const step = 100 / colors.length;
  return `linear-gradient(180deg, ${colors
    .map((color, index) => {
      const start = Math.round(index * step);
      const end = Math.round((index + 1) * step);
      return `${color} ${start}% ${end}%`;
    })
    .join(", ")})`;
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

type EnrichedSession = GridSession & { types: SessionType[]; slot: Slot };

export type WeekMatch = {
  id: string;
  starts_at: string;
  opponent: string | null;
  summary: string | null;
  home_away: string | null;
  kind: string | null;
  is_anchor: boolean;
  home_score?: number | null;
  away_score?: number | null;
};

/** Date locale (Europe/Zurich) `YYYY-MM-DD` d'un instant ISO. */
function zurichDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Index de mois (année*12+mois) d'une date `YYYY-MM-DD`, ou null. */
function monthIndexOf(ymdStr?: string): number | null {
  if (!ymdStr) return null;
  const [y, m] = ymdStr.split("-").map(Number);
  return y * 12 + (m - 1);
}

/** Ramène un mois dans la fenêtre de saison [start, end] (bornes incluses). */
function clampMonth(
  cur: { year: number; month: number },
  start?: string,
  end?: string,
): { year: number; month: number } {
  const idx = cur.year * 12 + cur.month;
  const min = monthIndexOf(start);
  const max = monthIndexOf(end);
  let clamped = idx;
  if (min !== null && clamped < min) clamped = min;
  if (max !== null && clamped > max) clamped = max;
  if (clamped === idx) return cur;
  return { year: Math.floor(clamped / 12), month: clamped % 12 };
}

export function PlannerWeeksGrid({
  teamId,
  season,
  sessions,
  macrocycles = [],
  matches = [],
  seasonStart,
  seasonEnd,
  evals = [],
  evalMetrics = [],
  placeEval = false,
}: {
  teamId: string;
  /** Millésime actif `YYYY/YY` — scope de l'effacement de saison. */
  season?: string;
  sessions: GridSession[];
  macrocycles?: Macrocycle[];
  matches?: WeekMatch[];
  /** Fenêtre de la saison active `YYYY-MM-DD` : borne la navigation mensuelle. */
  seasonStart?: string;
  seasonEnd?: string;
  /** Évals physiques posées sur le planning (1 max/jour, hors entraînements). */
  evals?: PlannerEval[];
  /** Catalogue des tests du club pour le wizard de placement d'éval. */
  evalMetrics?: EvalMetric[];
  /** Mode « placement d'éval » : un clic sur un jour ouvre le wizard. */
  placeEval?: boolean;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("planner.weeks");
  const tTour = useTranslations("planner.tour");
  const tTheme = useTranslations("planner.theme");
  const tAtt = useTranslations("attendance.coach");
  const today = ymd(new Date());
  const [isCreatingSlot, startSlotCreate] = useTransition();
  const [isSessionActionPending, startSessionAction] = useTransition();
  const [isClearing, startClear] = useTransition();

  function clearSeason() {
    if (isClearing || !season) return;
    if (!window.confirm(t("clearConfirm"))) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("locale", locale);
    fd.set("season", season);
    startClear(async () => {
      await clearSeasonAction(fd);
      router.refresh();
    });
  }
  const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

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
            id: micro.id,
            mesoId: meso.id,
            weekNumber: micro.week_number,
            theme: micro.theme,
            format: micro.format,
            notes: micro.notes,
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
            return clampMonth(
              { year: firstDate.getFullYear(), month: firstDate.getMonth() },
              seasonStart,
              seasonEnd,
            );
          }
        }
      }
      return clampMonth(
        { year: todayDate.getFullYear(), month: todayDate.getMonth() },
        seasonStart,
        seasonEnd,
      );
    },
  );
  const [activeTypes, setActiveTypes] = useState<Set<SessionType>>(
    () => new Set(TYPE_ORDER)
  );
  const [openMicroId, setOpenMicroId] = useState<string | null>(null);

  const enriched = useMemo<EnrichedSession[]>(
    () =>
	      sessions.map((s) => ({
	        ...s,
	        types: sessionTypes(s),
	        slot: slotOf(s.start),
	      })),
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

  // Évals physiques posées (1 max/jour) + état du wizard de placement.
  const evalByDate = useMemo(
    () => new Map(evals.map((e) => [e.date, e])),
    [evals],
  );
  const [wizardDate, setWizardDate] = useState<string | null>(null);
  const [evalSelected, setEvalSelected] = useState<Set<string>>(new Set());
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalPending, startEvalTransition] = useTransition();

  function toggleEvalMetric(id: string) {
    setEvalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submitEval() {
    if (!wizardDate || evalSelected.size === 0) return;
    setEvalError(null);
    startEvalTransition(async () => {
      const res = await createPhysicalTestAction({
        teamId,
        date: wizardDate,
        metricIds: [...evalSelected],
        locale,
      });
      if (res?.error) setEvalError(res.error);
      // En cas de succès, l'action redirige vers la page présences.
    });
  }

  const matchByDate = useMemo(() => {
    const m = new Map<string, WeekMatch>();
    for (const mt of matches) {
      const key = zurichDateKey(mt.starts_at);
      if (!m.has(key)) m.set(key, mt);
    }
    return m;
  }, [matches]);

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
	          if (!s.types.some((type) => activeTypes.has(type))) continue;
	          totalSessions++;
	          const min = s.durationMinutes ?? 0;
	          totalMin += min;
	          const split = min / s.types.length;
	          for (const type of s.types) {
	            byType.set(type, (byType.get(type) ?? 0) + split);
	          }
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

  function runSessionAction(
    action: () => Promise<{ error?: string } | undefined | void>,
  ) {
    if (isSessionActionPending) return;
    startSessionAction(async () => {
      const result = await action();
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  function dropOnSlot(e: DragEvent, date: string, slot: Slot) {
    e.preventDefault();
    e.stopPropagation();
    const sessionId =
      e.dataTransfer.getData("text/plain") || draggingSessionId || "";
    setDraggingSessionId(null);
    if (!sessionId) return;
    runSessionAction(() =>
      movePlannerSessionAction({
        teamId,
        sessionId,
        date,
        slot,
        locale,
      }),
    );
  }

  function pasteCopiedSession(date: string, slot: Slot, keepSelection = false) {
    if (!copiedSessionId) return false;
    const sessionId = copiedSessionId;
    if (!keepSelection) setCopiedSessionId(null);
    runSessionAction(() =>
      duplicatePlannerSessionAction({
        teamId,
        sessionId,
        date,
        slot,
        locale,
      }),
    );
    return true;
  }

  const monthLabel = new Date(
    currentMonth.year,
    currentMonth.month,
    1,
  ).toLocaleDateString(locale, { month: "long", year: "numeric" });

  const currentMonthIndex = currentMonth.year * 12 + currentMonth.month;
  const minMonthIndex = monthIndexOf(seasonStart);
  const maxMonthIndex = monthIndexOf(seasonEnd);
  const canPrev = minMonthIndex === null || currentMonthIndex > minMonthIndex;
  const canNext = maxMonthIndex === null || currentMonthIndex < maxMonthIndex;

  const shiftMonth = (delta: number) =>
    setCurrentMonth((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return clampMonth(
        { year: d.getFullYear(), month: d.getMonth() },
        seasonStart,
        seasonEnd,
      );
    });

  const jumpToToday = () => {
    const now = new Date();
    setCurrentMonth(
      clampMonth(
        { year: now.getFullYear(), month: now.getMonth() },
        seasonStart,
        seasonEnd,
      ),
    );
  };

  const totalHours = Math.floor(stats.totalMin / 60);
  const totalRem = stats.totalMin % 60;
  const avgPerWeekHours = Math.round((stats.totalMin / weeks.length / 60) * 10) / 10;
  const sortedByType = [...stats.byType.entries()].sort((a, b) => b[1] - a[1]);

  const monthHasPeriodization = weeks.some((w) => microByStart.has(ymd(w)));

  const renderWeekRow = (
    weekStart: Date,
    _wi: number,
    micro: MicroLookup | undefined
  ): React.ReactNode => {
    const weekEnd = addDays(weekStart, 6);
    const isCurrentWeek = ymd(weekStart) <= today && today <= ymd(weekEnd);
    const isPastWeek = ymd(weekEnd) < today;

    if (!micro) {
      return (
        <div
          key={ymd(weekStart)}
          className="col-span-full flex items-center gap-3 border-b border-dashed border-border px-4 py-2 text-[11px] text-muted-foreground"
        >
          <span className="h-px flex-1 border-t border-dashed border-border" />
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
          <span className="h-px flex-1 border-t border-dashed border-border" />
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
	        if (!s.types.some((type) => activeTypes.has(type))) continue;
	        const min = s.durationMinutes ?? 0;
	        weekTotal += min;
	        sessionCount++;
	        const split = min / s.types.length;
	        for (const type of s.types) {
	          weekByType.set(type, (weekByType.get(type) ?? 0) + split);
	        }
	      }
	    }

    const isPickerOpen = openMicroId === micro.id;
    const themeDot = themeColors?.dot ?? "#cbd5e1";

    const pastWeekClass = isPastWeek
      ? "opacity-60 saturate-[0.65] [&_button]:pointer-events-auto"
      : "";

    return (
      <div key={ymd(weekStart)} className="contents">
        <div
          className={`flex flex-col justify-between gap-2 border-b border-r border-l-[5px] border-border px-3.5 py-3 ${themeColors?.bg ?? "bg-muted/70"} ${pastWeekClass}`}
          style={{ borderLeftColor: themeDot }}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-bold tracking-tight text-foreground">
                  {weekLabelText}
                </span>
                {isCurrentWeek ? (
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("tag.current")}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
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
            <div className="relative mt-2">
              <button
                type="button"
                onClick={() =>
                  setOpenMicroId(isPickerOpen ? null : micro.id)
                }
                className={`flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${
                  themeLabel
                    ? "border-border bg-card/80 hover:bg-card"
                    : "border-dashed border-border bg-muted/40 hover:bg-muted/80"
                }`}
                title={themeLabel ?? tTour("setTheme")}
                aria-haspopup="dialog"
                aria-expanded={isPickerOpen}
              >
                <span
                  className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: themeDot }}
                />
                <span className="flex-1 text-[11px] font-semibold leading-tight text-foreground">
                  {themeLabel ? (
                    <span className="line-clamp-2">{themeLabel}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      + {tTour("setTheme")}
                    </span>
                  )}
                </span>
              </button>
              {isPickerOpen ? (
                <MicrocycleThemePicker
                  microcycleId={micro.id}
                  teamId={teamId}
                  currentTheme={micro.theme}
                  currentFormat={micro.format}
                  currentNotes={micro.notes}
                  onClose={() => setOpenMicroId(null)}
                  placement="inline"
                />
              ) : null}
            </div>
            {formatLabel ? (
              <div className="mt-1 text-[10px] text-muted-foreground">
                {formatLabel}
              </div>
            ) : null}
          </div>
        </div>

        {DAYS.map((_, di) => {
          const cellDate = addDays(weekStart, di);
          const dateStr = ymd(cellDate);
	          const list = (byDate.get(dateStr) ?? []).filter((s) =>
	            s.types.some((type) => activeTypes.has(type)),
	          );
          const morning = list.find((s) => s.slot === "morning") ?? null;
          const afternoon = list.find((s) => s.slot === "afternoon") ?? null;
          const cellMatch = matchByDate.get(dateStr) ?? null;
          const cellEval = evalByDate.get(dateStr) ?? null;
          const isToday = dateStr === today;
          const isWeekend = di >= 5;
          const canPlaceEval = placeEval && !cellEval;

          const goToNew = (slot: Slot) => {
            if (isCreatingSlot) return;
            startSlotCreate(async () => {
              await createSessionForSlotAction({
                teamId,
                date: dateStr,
                slot,
                locale,
              });
            });
          };

          const baseBg = isToday
            ? "bg-amber-50/60 dark:bg-amber-950/20"
            : isWeekend
              ? "bg-muted/70"
              : "bg-card";

          const renderSlot = (
            slot: Slot,
            session: EnrichedSession | null,
            label: string
          ) => {
	              if (session) {
	                const time = timeOf(session.start);
	                const isCopied = copiedSessionId === session.id;
	                return (
	                  <div
	                  draggable={!isSessionActionPending}
	                  onDragStart={(e) => {
	                    e.dataTransfer.effectAllowed = "move";
	                    e.dataTransfer.setData("text/plain", session.id);
	                    setDraggingSessionId(session.id);
	                  }}
	                  onDragEnd={() => setDraggingSessionId(null)}
                  className={`group/session relative flex w-full flex-col overflow-hidden rounded-lg border bg-muted/70 text-left text-foreground shadow-sm transition-all duration-150 hover:-translate-y-px hover:border-input hover:bg-card hover:shadow-md active:scale-[0.99] ${
	                      isCopied
	                        ? "border-primary ring-2 ring-ring/20"
	                        : "border-border"
	                    } ${draggingSessionId === session.id ? "opacity-50" : ""}`}
	                  >
	                  <span
	                    aria-hidden="true"
	                    className="absolute bottom-0 left-0 top-0 w-[3px]"
	                    style={{ background: typeBar(session.types) }}
	                  />
	                  <button
	                    type="button"
	                    onClick={(e) => {
	                      e.stopPropagation();
	                      router.push(
	                        `/planner/${teamId}/sessions/${session.id}/preparation`,
	                      );
	                    }}
	                      title={session.title}
                      className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5 pl-3 pr-2 text-left"
	                  >
	                    <span className="flex items-center justify-between gap-2">
	                      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
	                        {time ?? ""}
	                      </span>
	                      {session.durationMinutes ? (
	                        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
	                          {session.durationMinutes}&apos;
	                        </span>
	                      ) : null}
	                    </span>
	                    <span className="truncate text-[11px] font-semibold leading-tight text-foreground">
	                      {session.types.includes("match") ? "⚽ " : ""}
	                      {session.title}
	                    </span>
	                  </button>
                  <div className="flex w-full items-center border-t border-border pl-2">
                    <button
                      type="button"
                      title={tAtt("openLink")}
                      aria-label={tAtt("openLink")}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(
                          `/planner/${teamId}/sessions/${session.id}/attendance`,
                        );
                      }}
                      className="inline-flex h-6 min-w-0 flex-1 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <Users size={13} strokeWidth={2.2} />
                    </button>
                    <button
	                      type="button"
	                      title={t("duplicate")}
	                      aria-label={t("duplicateSessionAria")}
	                        disabled={isSessionActionPending}
	                        onClick={(e) => {
	                          e.stopPropagation();
	                          setCopiedSessionId((current) =>
	                            current === session.id ? null : session.id,
	                          );
	                        }}
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${
                        isCopied
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
	                    >
	                      <Copy size={12} strokeWidth={2.2} />
	                    </button>
	                    <button
	                      type="button"
	                      title={t("delete")}
	                      aria-label={t("deleteSessionAria")}
	                      disabled={isSessionActionPending}
	                      onClick={(e) => {
	                        e.stopPropagation();
	                        if (!window.confirm(t("confirmDeleteSession"))) return;
	                        runSessionAction(() =>
	                          deletePlannerSessionAction({
	                            teamId,
	                            sessionId: session.id,
	                            locale,
	                          }),
	                        );
	                      }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-destructive transition hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-40"
	                    >
	                      <Trash2 size={12} strokeWidth={2.2} />
	                    </button>
	                  </div>
	                </div>
	              );
	            }
	            return (
	              <button
                type="button"
	                onClick={(e) => {
	                  e.stopPropagation();
	                  if (pasteCopiedSession(dateStr, slot, e.metaKey || e.ctrlKey)) {
	                    return;
	                  }
	                  goToNew(slot);
	                }}
	                onKeyDown={(e) => {
	                  if (e.key === "Enter" || e.key === " ") {
	                    e.preventDefault();
	                    e.stopPropagation();
	                    if (pasteCopiedSession(dateStr, slot)) return;
	                    goToNew(slot);
		                  }
		                }}
	                onDragOver={(e) => {
	                  if (!draggingSessionId) return;
	                  e.preventDefault();
	                  e.dataTransfer.dropEffect = "move";
	                }}
	                onDrop={(e) => dropOnSlot(e, dateStr, slot)}
                className={`flex h-8 w-full items-center justify-between gap-1 rounded-lg border border-dashed px-2 text-[11px] font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  copiedSessionId
                    ? "border-input bg-card text-foreground shadow-sm hover:bg-accent"
                    : "border-border bg-transparent text-muted-foreground hover:border-input hover:bg-accent hover:text-foreground"
                } ${
		                  draggingSessionId || copiedSessionId
		                    ? "opacity-100"
		                    : "opacity-0 group-hover:opacity-100"
		                }`}
		              >
	                <span className="font-semibold uppercase tracking-wide">
	                  {copiedSessionId ? t("pasteHere") : label}
	                </span>
	                <span>{copiedSessionId ? <Copy size={11} /> : "+"}</span>
              </button>
            );
          };

          return (
            <div
              key={dateStr}
              onClick={canPlaceEval ? () => setWizardDate(dateStr) : undefined}
              className={`group relative flex min-h-[112px] flex-col gap-1 border-b border-r border-border p-1.5 text-left transition-colors ${baseBg} ${pastWeekClass} ${
                canPlaceEval
                  ? "cursor-pointer ring-1 ring-inset ring-transparent hover:ring-primary hover:bg-accent/40"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] tabular-nums ${
                    isToday
                      ? "rounded bg-foreground px-1 py-px font-semibold text-background"
                      : "text-muted-foreground"
                  }`}
                >
                  {cellDate.getDate()}
                </span>
                {canPlaceEval ? (
                  <span className="rounded bg-primary px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-primary-foreground opacity-0 group-hover:opacity-100">
                    + {t("physicalTest.badge")}
                  </span>
                ) : null}
              </div>
              {cellEval ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/planner/${teamId}/sessions/${cellEval.id}/test`,
                    );
                  }}
                  title={t("physicalTest.open")}
                  className="flex min-h-[38px] w-full items-center justify-between gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-left text-red-800 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                >
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
                    <Activity className="h-3.5 w-3.5 shrink-0" />
                    {t("physicalTest.badge")}
                  </span>
                  <span className="text-[9px] font-medium">
                    {cellEval.testCount > 0
                      ? t("physicalTest.testsCount", { n: cellEval.testCount })
                      : t("physicalTest.open")}
                  </span>
                </button>
              ) : null}
              {cellMatch ? (
                <button
                  type="button"
                  title={cellMatch.summary ?? cellMatch.opponent ?? "Match"}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/planner/${teamId}/match/${cellMatch.id}`);
                  }}
                  className={`flex min-h-[56px] w-full flex-col items-start justify-between gap-1 rounded-md border px-2 py-1.5 text-left transition hover:brightness-105 ${
                    isStructuringKind(cellMatch.kind)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-primary/30 bg-accent text-primary"
                  }`}
                >
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide opacity-80">
                    <span aria-hidden="true">⚽</span>
                    {t("matchLabel")}
                  </span>
                  <span className="line-clamp-2 text-[11px] font-semibold leading-tight">
                    {cellMatch.summary ?? cellMatch.opponent ?? "Match"}
                  </span>
                  {cellMatch.home_score != null && cellMatch.away_score != null ? (
                    <span className="rounded bg-black/15 px-1.5 py-0.5 text-xs font-bold tabular-nums">
                      {cellMatch.home_score}–{cellMatch.away_score}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {cellMatch ? null : renderSlot("morning", morning, t("slot.morning"))}
              {cellMatch ? null : renderSlot("afternoon", afternoon, t("slot.afternoon"))}
            </div>
          );
        })}

        <div
          className={`flex flex-col gap-2 border-b border-l border-border bg-muted/60 px-3 py-3 text-[11px] ${pastWeekClass}`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t("sessions")}</span>
            <strong className="font-semibold tabular-nums text-foreground">
              {sessionCount}
            </strong>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t("totalTime")}</span>
            <strong className="font-semibold tabular-nums text-foreground">
              {Math.floor(weekTotal / 60)}h {weekTotal % 60}m
            </strong>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-border">
            {weekTotal > 0
              ? [...weekByType.entries()].map(([type, min]) => (
	                <span
	                  key={type}
	                  title={`${t(`type.${type}`)}: ${Math.round(min)}m`}
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
      {placeEval ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary bg-accent/60 px-3 py-2 text-[13px] font-medium text-primary">
          <Activity className="h-4 w-4 shrink-0" />
          {t("physicalTest.placementHint")}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/60 p-3">
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={!canPrev}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground shadow-sm transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t("prev")}
          >
            ‹
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold tracking-tight capitalize text-foreground">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={!canNext}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground shadow-sm transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t("next")}
          >
            ›
          </button>
          <button
            type="button"
            onClick={jumpToToday}
            className="ml-1 inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-all duration-150 hover:bg-accent hover:ring-1 hover:ring-border active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on
                    ? "border-border bg-card text-foreground shadow-sm"
                    : "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
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
          {macrocycles.length > 0 && season ? (
            <button
              type="button"
              onClick={clearSeason}
              disabled={isClearing}
              className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/30 bg-card px-3 text-xs font-medium text-destructive transition-all duration-150 hover:bg-destructive/10 active:scale-[0.98] disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isClearing ? t("clearing") : t("clearSeason")}
            </button>
          ) : null}
        </div>
      </div>

      {!monthHasPeriodization ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          <span>{t("emptyMonth")}</span>
          <button
            type="button"
            onClick={() =>
              router.push({
                pathname: `/planner/${teamId}`,
                query: { view: "tour" },
              })
            }
            className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent"
          >
            {t("emptyMonthCta")}
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <div className="grid min-w-[1080px] grid-cols-[200px_repeat(7,minmax(0,1fr))_200px]">
          <div className="border-b border-r border-border bg-muted px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("week")}
          </div>
          {DAYS.map((d) => (
            <div
              key={d}
              className="border-b border-r border-border bg-muted px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {t(`day.${d}`)}
            </div>
          ))}
          <div className="border-b border-border bg-muted px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                    className="col-span-full grid grid-cols-[200px_1fr_200px] border-b border-border bg-foreground text-[11px] font-semibold uppercase tracking-wider text-background"
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
                    <div className="px-3 py-1.5 text-right normal-case tracking-normal text-background/60">
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

      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-muted/70 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("sessions")}
          </span>
          <span className="text-lg font-bold tabular-nums tracking-tight text-foreground">
            {stats.totalSessions}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("totalTime")}
          </span>
          <span className="text-lg font-bold tabular-nums tracking-tight text-foreground">
            {totalHours}
            <span className="ml-0.5 text-xs font-medium text-muted-foreground">
              h {totalRem}m
            </span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("avgPerWeek")}
          </span>
          <span className="text-lg font-bold tabular-nums tracking-tight text-foreground">
            {avgPerWeekHours}
            <span className="ml-0.5 text-xs font-medium text-muted-foreground">
              h
            </span>
          </span>
        </div>
        <div className="flex max-w-[420px] flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("typeDistribution")}
          </span>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-border">
            {stats.totalMin > 0
              ? sortedByType.map(([type, min]) => (
	                  <span
	                    key={type}
	                    title={`${t(`type.${type}`)}: ${Math.round(min)}m`}
	                    className="block h-full"
                    style={{
                      width: `${(min / stats.totalMin) * 100}%`,
                      background: TYPE_COLOR[type],
                    }}
                  />
                ))
              : null}
          </div>
          <div className="flex flex-wrap gap-2.5 text-[10px] text-muted-foreground">
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

      {wizardDate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setWizardDate(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Activity className="h-4 w-4 text-primary" />
                {t("physicalTest.wizardTitle")}
              </h3>
              <button
                type="button"
                onClick={() => setWizardDate(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={t("physicalTest.close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-[13px] text-muted-foreground">
              {t("physicalTest.wizardSubtitle", { date: wizardDate })}
            </p>

            {evalError ? (
              <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {evalError}
              </div>
            ) : null}

            {evalMetrics.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {t("physicalTest.noTests")}
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {evalMetrics.map((m) => {
                  const checked = evalSelected.has(m.id);
                  return (
                    <li key={m.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEvalMetric(m.id)}
                          className="h-4 w-4 rounded border-input accent-primary"
                        />
                        <span className="font-medium text-foreground">
                          {m.name}
                        </span>
                        {(m.category || m.unit) && (
                          <span className="text-[11px] text-muted-foreground">
                            {[m.category, m.unit].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => router.push("/tracking")}
                className="text-[13px] font-medium text-primary hover:underline"
              >
                {t("physicalTest.createTest")}
              </button>
              <button
                type="button"
                disabled={evalPending || evalSelected.size === 0}
                onClick={submitEval}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {t("physicalTest.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
