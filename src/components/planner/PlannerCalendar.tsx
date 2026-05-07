"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { PlannerTourView, type Macrocycle } from "./PlannerTourView";
import { PlannerWeeksGrid } from "./PlannerWeeksGrid";

type SessionEvent = {
  id: string;
  title: string;
  start: string;
  date: string;
  durationMinutes: number | null;
};

export type PlannerView = "tour" | "weekly";

const VIEW_ORDER: PlannerView[] = ["tour", "weekly"];

export function PlannerCalendar({
  teamId,
  view,
  events,
  macrocycles,
  teamName,
  season,
}: {
  teamId: string;
  view: PlannerView;
  events: SessionEvent[];
  macrocycles: Macrocycle[];
  teamName: string;
  season: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("planner.view");

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {VIEW_ORDER.map((v) => (
          <Button
            key={v}
            variant={view === v ? "primary" : "ghost"}
            size="sm"
            onClick={() =>
              router.push({ pathname: `/planner/${teamId}`, query: { view: v } })
            }
          >
            {t(v)}
          </Button>
        ))}
      </div>

      {view === "tour" ? (
        <PlannerTourView
          teamId={teamId}
          macrocycles={macrocycles}
          teamName={teamName}
          season={season}
        />
      ) : (
        <PlannerWeeksGrid
          teamId={teamId}
          sessions={events.map((e) => ({
            id: e.id,
            title: e.title,
            date: e.date,
            durationMinutes: e.durationMinutes,
          }))}
          macrocycles={macrocycles}
        />
      )}
    </div>
  );
}
