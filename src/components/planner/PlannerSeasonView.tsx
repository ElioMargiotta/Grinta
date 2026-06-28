"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useRouter as useIntlRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Settings2, Trash2 } from "lucide-react";
import { PlannerSeasonWizard, type SeasonPlanRow } from "./PlannerSeasonWizard";
import { clearSeasonAction } from "@/app/[locale]/(app)/planner/[teamId]/season-actions";
import { Select } from "@/components/ui/Select";
import { THEME_COLORS, THEME_OPTIONS } from "./MicrocycleThemePicker";

export type SeasonMatch = {
  id: string;
  starts_at: string;
  summary: string | null;
  location: string | null;
  kind: string | null;
  home_away: string | null;
  opponent: string | null;
  competition: string | null;
  is_anchor: boolean;
  source: string;
  home_score?: number | null;
  away_score?: number | null;
};

export type SeasonMicrocycle = {
  id: string;
  startDate: string;
  weekNumber: number;
  kind: string | null;
  theme: string | null;
  targetMatchId: string | null;
  seasonPlanId: string;
  sessions: {
    id: string;
    date: string;
    startTime: string | null;
    theme: string | null;
    mdOffset: number | null;
  }[];
};

type Subscription = {
  id: string;
  slot: "first_round" | "second_round" | "full";
  ics_url: string;
  last_synced_at: string | null;
  last_status: string | null;
  last_error: string | null;
  event_count: number;
};

type Periodization = {
  training_weekdays: number[];
  md_scheme: string;
};

type CalendarMatch = SeasonMatch & {
  ends_at: string | null;
  match_url: string | null;
};

type Segment = "first_round" | "second_round" | "full";
type Outcome = "win" | "draw" | "loss";

const SEGMENTS: Segment[] = ["first_round", "second_round", "full"];

function isSegment(v: string | null): v is Segment {
  return v === "first_round" || v === "second_round" || v === "full";
}

function currentSeasonLabel(): string {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

function seasonStartYear(label: string): number {
  const m = /^(\d{4})/.exec(label);
  return m ? Number(m[1]) : Number(currentSeasonLabel().slice(0, 4));
}

function segmentBounds(label: string, segment: Segment) {
  const year = seasonStartYear(label);
  if (segment === "first_round") {
    return { start: `${year}-07-01`, end: `${year}-12-25` };
  }
  if (segment === "second_round") {
    return { start: `${year + 1}-01-01`, end: `${year + 1}-07-31` };
  }
  return { start: `${year}-07-01`, end: `${year + 1}-07-31` };
}

/** Tour d'une semaine d'après son mois (ASF) : juil→déc = 1er tour, sinon 2e. */
function tourOfYmd(ymd: string): "first_round" | "second_round" {
  return Number(ymd.slice(5, 7)) >= 7 ? "first_round" : "second_round";
}

function shiftYmd(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

type MatchInfo = CalendarMatch & { played: boolean };

/** Sens V/N/D du point de vue de notre équipe, depuis le score objectif. */
function outcomeOf(m: MatchInfo): Outcome | null {
  if (m.home_score == null || m.away_score == null) return null;
  if (m.home_away !== "home" && m.home_away !== "away") return null;
  const away = m.home_away === "away";
  const our = away ? m.away_score : m.home_score;
  const opp = away ? m.home_score : m.away_score;
  if (our > opp) return "win";
  if (our < opp) return "loss";
  return "draw";
}

// Une ligne du tableau saison : soit une semaine d'entraînement générée
// (microcycle), soit un match officiel passé/à venir sans semaine générée
// (`weekNumber` null) — garantit que toute la saison est visible, passé inclus.
type SeasonRow = {
  key: string;
  date: string;
  weekNumber: number | null;
  phase: string | null;
  theme: string | null;
  sessions: SeasonMicrocycle["sessions"];
  match: MatchInfo | null;
  segment: Segment;
};

export function PlannerSeasonView({
  teamId,
  seasonLabel,
  matches,
  archivedMatches = [],
  subscriptions,
  periodization,
  seasonMicrocycles,
  seasonPlans = [],
}: {
  teamId: string;
  seasonLabel: string | null;
  matches: CalendarMatch[];
  archivedMatches?: CalendarMatch[];
  subscriptions: Subscription[];
  periodization: Periodization | null;
  seasonMicrocycles: SeasonMicrocycle[];
  seasonPlans?: SeasonPlanRow[];
}) {
  const t = useTranslations("planner.season");
  const tw = useTranslations("planner.wizard");
  const tTheme = useTranslations("planner.theme");
  const locale = useLocale();
  const router = useRouter();
  const intlRouter = useIntlRouter();
  const [isClearing, startClear] = useTransition();
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const selectedSeason = seasonLabel ?? currentSeasonLabel();

  // Tour/saison complète sélectionné — mémorisé par équipe (localStorage). Init
  // par défaut puis réhydraté côté client pour éviter le mismatch SSR.
  const storageKey = `grinta:planner:segment:${teamId}`;
  const [selectedSegment, setSelectedSegment] = useState<Segment>("first_round");
  useEffect(() => {
    // Réhydratation depuis localStorage au montage (évite le mismatch SSR) —
    // setState volontaire ici.
    const saved = localStorage.getItem(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSegment(saved)) setSelectedSegment(saved);
  }, [storageKey]);
  function changeSegment(v: Segment) {
    setSelectedSegment(v);
    try {
      localStorage.setItem(storageKey, v);
    } catch {
      // localStorage indisponible (mode privé) — non bloquant.
    }
  }

  const [now] = useState(() => Date.now());
  const planSegmentById = useMemo(
    () => new Map(seasonPlans.map((plan) => [plan.id, plan.segment])),
    [seasonPlans],
  );
  const visiblePlanSegments = useMemo(
    () =>
      new Set<Segment>(
        selectedSegment === "full" ? ["first_round", "second_round"] : [selectedSegment],
      ),
    [selectedSegment],
  );
  const generated = seasonMicrocycles.some(
    (microcycle) => {
      const planSegment = planSegmentById.get(microcycle.seasonPlanId);
      return planSegment ? visiblePlanSegments.has(planSegment) : false;
    },
  );
  const bounds = segmentBounds(selectedSeason, selectedSegment);
  const pause = useMemo(() => {
    if (selectedSegment !== "full") return null;
    const first = seasonPlans.find((plan) => plan.segment === "first_round");
    const second = seasonPlans.find((plan) => plan.segment === "second_round");
    if (!first || !second) return null;
    const hasFirst = seasonMicrocycles.some(
      (microcycle) => planSegmentById.get(microcycle.seasonPlanId) === "first_round",
    );
    const hasSecond = seasonMicrocycles.some(
      (microcycle) => planSegmentById.get(microcycle.seasonPlanId) === "second_round",
    );
    if (!hasFirst || !hasSecond) return null;
    const start = shiftYmd(first.end_date, 1);
    const end = shiftYmd(second.start_date, -1);
    return start <= end ? { start, end } : null;
  }, [seasonPlans, seasonMicrocycles, planSegmentById, selectedSegment]);

  // Lookup match (calendrier actif + matchs joués/archivés) → score des matchs
  // passés + lien vers la page match.
  const matchById = useMemo(() => {
    const map = new Map<string, MatchInfo>();
    for (const m of matches) {
      map.set(m.id, { ...m, played: new Date(m.starts_at).getTime() < now });
    }
    for (const m of archivedMatches) {
      if (!map.has(m.id)) map.set(m.id, { ...m, played: true });
    }
    return map;
  }, [matches, archivedMatches, now]);

  // Lignes du tableau : semaines générées + matchs officiels (passés ou à venir)
  // non couverts par une semaine. Triées par date → vue saison complète et fixe.
  const rows = useMemo<SeasonRow[]>(() => {
    const out: SeasonRow[] = [];
    for (const w of seasonMicrocycles) {
      const planSegment = planSegmentById.get(w.seasonPlanId);
      if (!planSegment || !visiblePlanSegments.has(planSegment)) continue;
      if (w.startDate < bounds.start || w.startDate > bounds.end) continue;
      const match = w.targetMatchId ? matchById.get(w.targetMatchId) ?? null : null;
      out.push({
        key: `w-${w.id}`,
        date: w.startDate,
        weekNumber: w.weekNumber,
        phase: w.kind,
        theme: w.theme,
        sessions: w.sessions,
        match,
        segment: planSegment,
      });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [seasonMicrocycles, matchById, planSegmentById, visiblePlanSegments, bounds.start, bounds.end]);

  const stats = useMemo(() => {
    let sessions = 0;
    let prep = 0;
    let comp = 0;
    let matchRows = 0;
    for (const r of rows) {
      sessions += r.sessions.length;
      if (r.phase === "preparation") prep++;
      else if (r.phase === "competition") comp++;
      if (r.match) matchRows++;
    }
    return { sessions, prep, comp, matchRows };
  }, [rows]);

  function clearSeason() {
    if (!generated || isClearing) return;
    if (!window.confirm(t("clearConfirm"))) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("locale", locale);
    fd.set("season", selectedSeason);
    startClear(async () => {
      await clearSeasonAction(fd);
      router.refresh();
    });
  }

  if (editingSegment) {
    return (
      <PlannerSeasonWizard
        teamId={teamId}
        initialSeasonLabel={selectedSeason}
        initialSegment={editingSegment}
        matches={matches}
        archivedMatches={archivedMatches}
        subscriptions={subscriptions}
        periodization={periodization}
        seasonPlans={seasonPlans}
        existingMicrocycles={seasonMicrocycles}
        generated={generated}
        onClose={() => setEditingSegment(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="border-y border-border py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Select
            id="segment-filter"
            label={t("tourFilter")}
            value={selectedSegment}
            onChange={(e) => changeSegment(e.target.value as Segment)}
          >
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {tw(`segment.${s}`)}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap items-center gap-2">
            {generated ? (
              <button
                type="button"
                onClick={clearSeason}
                disabled={isClearing}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-destructive/30 bg-card px-3 text-[12px] font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isClearing ? t("clearing") : t("clearSeason")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setEditingSegment(selectedSegment)}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] bg-primary px-3 text-[12px] font-medium text-primary-foreground transition hover:brightness-95"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {generated ? t("editPlanning") : t("createPlanning")}
            </button>
          </div>
        </div>
      </section>

      {matches.length === 0 && archivedMatches.length === 0 ? (
        <EmptyState title={t("emptyNoMatchesTitle")} hint={t("emptyNoMatchesHint")} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("emptyNoAnchorsTitle")} hint={t("emptyNoAnchorsHint")} />
      ) : (
        <>
          <section>
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {tw("gridTitle")}
              </div>
              <div className="text-xs text-muted-foreground">
                {tw("weekN", { n: rows.length })} · {tw(`segment.${selectedSegment}`)}
              </div>
            </div>

            <div className="overflow-x-auto rounded-[10px] border border-border">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-muted text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="w-12 border-b border-border px-2.5 py-2">
                      {tw("col.week")}
                    </th>
                    <th className="border-b border-l border-border px-2.5 py-2">
                      {tw("col.date")}
                    </th>
                    <th className="border-b border-l border-border px-2.5 py-2">
                      {tw("col.phase")}
                    </th>
                    <th className="border-b border-l border-border px-2.5 py-2">
                      {tw("col.theme")}
                    </th>
                    <th className="border-b border-l border-border px-2.5 py-2">
                      {tw("col.trainings")}
                    </th>
                    <th className="border-b border-l border-border px-2.5 py-2">
                      {tw("col.match")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const tour = tourOfYmd(row.date);
                    const previousRow = rows[idx - 1];
                    const showPauseHeader =
                      Boolean(pause) &&
                      row.segment === "second_round" &&
                      previousRow?.segment === "first_round";
                    const showTourHeader =
                      selectedSegment === "full" &&
                      (idx === 0 || tourOfYmd(rows[idx - 1].date) !== tour);
                    return (
                      <Fragment key={row.key}>
                        {showPauseHeader && pause ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="border-y border-dashed border-border bg-muted px-3 py-4 text-center"
                            >
                              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                                {tw("pauseTitle")}
                              </div>
                              <div className="mt-1 text-xs font-medium text-foreground">
                                {tw("pauseDates", {
                                  start: new Date(`${pause.start}T00:00:00`).toLocaleDateString(locale),
                                  end: new Date(`${pause.end}T00:00:00`).toLocaleDateString(locale),
                                })}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                        {showTourHeader ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="border-y border-border bg-muted px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground"
                            >
                              {tw(`segment.${tour}`)}
                            </td>
                          </tr>
                        ) : null}
                        <RowView
                          n={row.weekNumber ?? idx + 1}
                          row={row}
                          locale={locale}
                          t={t}
                          tw={tw}
                          tTheme={tTheme}
                          onOpenMatch={(id) => intlRouter.push(`/planner/${teamId}/match/${id}`)}
                          onOpenSession={(id) =>
                            intlRouter.push(`/planner/${teamId}/sessions/${id}/preparation`)
                          }
                        />
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {tw("statsTitle")}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label={tw("statWeeks")} value={rows.length} />
              <Stat label={tw("statPrep")} value={stats.prep} />
              <Stat label={tw("statComp")} value={stats.comp} />
              <Stat label={tw("statMatches")} value={stats.matchRows} />
              <Stat label={tw("statSessions")} value={stats.sessions} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function RowView({
  n,
  row,
  locale,
  t,
  tw,
  tTheme,
  onOpenMatch,
  onOpenSession,
}: {
  n: number;
  row: SeasonRow;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  tw: ReturnType<typeof useTranslations>;
  tTheme: ReturnType<typeof useTranslations>;
  onOpenMatch: (id: string) => void;
  onOpenSession: (id: string) => void;
}) {
  const dateStr = new Date(`${row.date}T00:00:00`).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  });
  const isWeek = row.weekNumber != null;
  const theme = row.theme;
  const themeColor =
    theme && THEME_OPTIONS.includes(theme as (typeof THEME_OPTIONS)[number])
      ? THEME_COLORS[theme as keyof typeof THEME_COLORS]?.dot
      : "#d4d4d8";
  const phase = row.phase;
  const sessions = row.sessions.slice().sort((a, b) => a.date.localeCompare(b.date));
  const match = row.match;
  const outcome = match ? outcomeOf(match) : null;
  const hasScore = match?.home_score != null && match?.away_score != null;
  const td = "border-b border-l border-border px-2.5 py-1.5 align-middle";

  const outcomeChip =
    outcome === "win"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : outcome === "loss"
        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "bg-muted text-foreground";

  return (
    <tr className="text-foreground odd:bg-card even:bg-muted/40 hover:bg-accent">
      <td className="border-b border-border px-2.5 py-1.5 align-middle font-semibold text-foreground">
        {isWeek ? tw("weekBadge", { n }) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className={`${td} whitespace-nowrap capitalize`}>{dateStr}</td>
      <td className={`${td} whitespace-nowrap text-muted-foreground`}>
        {phase && tw.has(`phase.${phase}`) ? tw(`phase.${phase}`) : phase ?? "—"}
      </td>
      <td className={td}>
        {isWeek ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: themeColor }} />
            <span className="truncate">
              {theme
                ? tTheme.has(`option.${theme}`)
                  ? tTheme(`option.${theme}`)
                  : theme
                : t("noTheme")}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className={td}>
        {sessions.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenSession(s.id)}
                title={s.theme ?? undefined}
                className="inline-flex items-center gap-1 rounded-[5px] bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground transition hover:bg-accent"
              >
                {new Date(`${s.date}T00:00:00`).toLocaleDateString(locale, { weekday: "short" })}
              </button>
            ))}
          </span>
        )}
      </td>
      <td className={td}>
        {match ? (
          <button
            type="button"
            onClick={() => onOpenMatch(match.id)}
            className="inline-flex min-w-0 items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span className="truncate">
              {match.home_away === "away" ? "@ " : ""}
              {match.summary ?? match.opponent ?? t("matchFallback")}
            </span>
            {hasScore ? (
              <span className={`rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums ${outcomeChip}`}>
                {match.home_score}–{match.away_score}
              </span>
            ) : match.played ? (
              <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {t("resultToEnter")}
              </span>
            ) : null}
          </button>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-3 py-2.5">
      <div className="text-2xl font-semibold tabular-nums leading-none text-foreground">
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center">
      <CalendarDays className="h-8 w-8 text-muted-foreground" />
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
