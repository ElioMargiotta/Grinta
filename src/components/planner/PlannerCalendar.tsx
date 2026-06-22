"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { type Macrocycle } from "./PlannerTourView";
import { PlannerWeeksGrid } from "./PlannerWeeksGrid";
import {
  PlannerSeasonView,
  type SeasonMatch,
  type SeasonMicrocycle,
} from "./PlannerSeasonView";
import type { SeasonPlanRow } from "./PlannerSeasonWizard";
import { seasonWindow } from "@/lib/planner/seasons";
import type { FocusFamily } from "@/components/sheet/types";

type SessionEvent = {
  id: string;
  title: string;
  start: string;
  date: string;
  durationMinutes: number | null;
  focusFamilies?: FocusFamily[];
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

export type PlannerEval = { id: string; date: string; testCount: number };
export type EvalMetric = {
  id: string;
  name: string;
  unit: string | null;
  category: string | null;
};

export type PlannerView = "season" | "weekly";

const VIEW_ORDER: PlannerView[] = ["season", "weekly"];

export function PlannerCalendar({
  teamId,
  view,
  events,
  macrocycles,
  season,
  matches,
  archivedMatches = [],
  subscriptions,
  periodization,
  seasonMicrocycles,
  seasonPlans = [],
  evals = [],
  evalMetrics = [],
  placeEval = false,
}: {
  teamId: string;
  view: PlannerView;
  events: SessionEvent[];
  macrocycles: Macrocycle[];
  season: string;
  matches: CalendarMatch[];
  archivedMatches?: CalendarMatch[];
  subscriptions: Subscription[];
  periodization: Periodization | null;
  seasonMicrocycles: SeasonMicrocycle[];
  seasonPlans?: SeasonPlanRow[];
  evals?: PlannerEval[];
  evalMetrics?: EvalMetric[];
  placeEval?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("planner.view");

  const goTo = (v: PlannerView) =>
    router.push({ pathname: `/planner/${teamId}`, query: { view: v, season } });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex w-fit gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {VIEW_ORDER.map((v) => (
            <Button
              key={v}
              variant={view === v ? "primary" : "ghost"}
              size="sm"
              onClick={() => goTo(v)}
            >
              {t(v)}
            </Button>
          ))}
        </div>
      </div>

      {view === "season" ? (
        <PlannerSeasonView
          teamId={teamId}
          seasonLabel={season}
          matches={matches}
          archivedMatches={archivedMatches}
          subscriptions={subscriptions}
          periodization={periodization}
          seasonMicrocycles={seasonMicrocycles}
          seasonPlans={seasonPlans}
        />
      ) : (
        <PlannerWeeksGrid
          teamId={teamId}
          season={season}
          sessions={events.map((e) => ({
            id: e.id,
            title: e.title,
            date: e.date,
            start: e.start,
            durationMinutes: e.durationMinutes,
            focusFamilies: e.focusFamilies,
          }))}
          macrocycles={macrocycles}
          seasonStart={seasonWindow(season).start}
          seasonEnd={seasonWindow(season).end}
          matches={[...matches, ...archivedMatches].map((m) => ({
            id: m.id,
            starts_at: m.starts_at,
            opponent: m.opponent,
            summary: m.summary,
            home_away: m.home_away,
            kind: m.kind,
            is_anchor: m.is_anchor,
            home_score: m.home_score ?? null,
            away_score: m.away_score ?? null,
          }))}
          evals={evals}
          evalMetrics={evalMetrics}
          placeEval={placeEval}
        />
      )}
    </div>
  );
}
