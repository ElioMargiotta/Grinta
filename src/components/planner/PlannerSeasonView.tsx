"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Trash2 } from "lucide-react";
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
};

export type SeasonMicrocycle = {
  id: string;
  startDate: string;
  weekNumber: number;
  kind: string | null;
  theme: string | null;
  targetMatchId: string | null;
  sessions: { id: string; date: string; theme: string | null; mdOffset: number | null }[];
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

function localYmd(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
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
  const [isClearing, startClear] = useTransition();
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  // Saison pilotée au niveau page (sélecteur global) — pas de second sélecteur ici.
  const selectedSeason = seasonLabel ?? currentSeasonLabel();
  const [selectedSegment, setSelectedSegment] = useState<Segment>("first_round");

  const anchors = useMemo(
    () =>
      matches
        .filter((m) => m.is_anchor)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [matches],
  );

  const generated = seasonMicrocycles.length > 0;
  const bounds = segmentBounds(selectedSeason, selectedSegment);
  const filteredMatches = anchors.filter((m) => {
    const ymd = localYmd(m.starts_at);
    return ymd >= bounds.start && ymd <= bounds.end;
  });
  const matchById = new Map(filteredMatches.map((m) => [m.id, m]));
  const filteredWeeks = seasonMicrocycles
    .filter((mc) => mc.startDate >= bounds.start && mc.startDate <= bounds.end)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

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
        generated={generated}
        onClose={() => setEditingSegment(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="border-y border-zinc-200 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Select
            id="segment-filter"
            label={t("tourFilter")}
            value={selectedSegment}
            onChange={(e) => setSelectedSegment(e.target.value as Segment)}
          >
            <option value="first_round">{tw("segment.first_round")}</option>
            <option value="second_round">{tw("segment.second_round")}</option>
            <option value="full">{tw("segment.full")}</option>
          </Select>
          <div className="flex items-center gap-2">
            {generated ? (
              <button
                type="button"
                onClick={clearSeason}
                disabled={isClearing}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-red-200 bg-white px-3 text-[12px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isClearing ? t("clearing") : t("clearSeason")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setEditingSegment(selectedSegment)}
              className="inline-flex h-8 items-center justify-center rounded-[8px] bg-zinc-950 px-3 text-[12px] font-medium text-white transition hover:bg-zinc-800"
            >
              {generated ? t("editPlanning") : t("createPlanning")}
            </button>
          </div>
        </div>
      </section>

      {matches.length === 0 ? (
        <EmptyState
          title={t("emptyNoMatchesTitle")}
          hint={t("emptyNoMatchesHint")}
        />
      ) : anchors.length === 0 ? (
        <EmptyState
          title={t("emptyNoAnchorsTitle")}
          hint={t("emptyNoAnchorsHint")}
        />
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between border-b border-zinc-200 pb-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
              {t("weeklyOverview")}
            </div>
            <div className="text-xs text-zinc-500">
              {filteredWeeks.length} {t("weeksMetric")} · {filteredMatches.length} {t("matchesMetric")}
            </div>
          </div>
          {filteredWeeks.length === 0 ? (
            <p className="border-b border-zinc-200 py-4 text-sm text-zinc-500">
              {generated ? t("noWeeksForFilter") : t("notGeneratedYet")}
            </p>
          ) : (
            <ol className="divide-y divide-zinc-200 border-b border-zinc-200">
              {filteredWeeks.map((week) => {
                const match = week.targetMatchId ? matchById.get(week.targetMatchId) : null;
                const theme = week.theme;
                const themeColor =
                  theme && THEME_OPTIONS.includes(theme as (typeof THEME_OPTIONS)[number])
                    ? THEME_COLORS[theme as keyof typeof THEME_COLORS]?.dot
                    : "#d4d4d8";
                return (
                  <li
                    key={week.id}
                    className="grid gap-3 py-3 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)]"
                  >
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      {formatWeek(week.startDate, locale)}
                    </div>
                    <div className="flex min-w-0 items-center gap-2 text-sm text-zinc-900">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: themeColor }}
                      />
                      <span className="truncate">
                        {theme ? tTheme(`option.${theme}`) : t("noTheme")}
                      </span>
                    </div>
                    <div className="min-w-0 text-sm text-zinc-500">
                      {match ? match.opponent ?? match.summary ?? t("matchFallback") : "—"}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}

function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--club-line)] bg-white/40 p-8 text-center">
      <CalendarDays className="h-8 w-8 text-zinc-300" />
      <div>
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
        <p className="mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{hint}</p>
      </div>
    </div>
  );
}

function formatWeek(ymd: string, locale: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  });
}
