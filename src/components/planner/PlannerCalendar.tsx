"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import multiMonthPlugin from "@fullcalendar/multimonth";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";

type SessionEvent = {
  id: string;
  title: string;
  start: string;
};

type View = "year" | "month" | "week" | "day";

const VIEW_TO_FC: Record<View, string> = {
  year: "multiMonthYear",
  month: "dayGridMonth",
  week: "timeGridWeek",
  day: "timeGridDay",
};

export function PlannerCalendar({
  teamId,
  view,
  events,
}: {
  teamId: string;
  view: View;
  events: SessionEvent[];
}) {
  const router = useRouter();
  const t = useTranslations("planner.view");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(VIEW_TO_FC) as View[]).map((v) => (
          <Button
            key={v}
            variant={view === v ? "primary" : "secondary"}
            size="sm"
            onClick={() =>
              router.push({ pathname: `/planner/${teamId}`, query: { view: v } })
            }
          >
            {t(v)}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <FullCalendar
          key={view}
          plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin]}
          initialView={VIEW_TO_FC[view]}
          headerToolbar={{ start: "prev,next today", center: "title", end: "" }}
          height="auto"
          events={events}
          dateClick={(info) =>
            router.push({
              pathname: `/planner/${teamId}/sessions/new`,
              query: { date: info.dateStr.slice(0, 10) },
            })
          }
          eventClick={(info) =>
            router.push(`/planner/${teamId}/sessions/${info.event.id}`)
          }
        />
      </div>
    </div>
  );
}
