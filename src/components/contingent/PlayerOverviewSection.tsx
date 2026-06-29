"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  TrendingUp,
} from "lucide-react";
import { Section } from "@/components/ui/Section";
import { formatDay } from "@/lib/contingent/week";
import { KindBadge } from "@/components/contingent/AvailabilitySection";
import {
  activeUnavailability,
  type Unavailability,
} from "@/lib/availability/unavailability";
import type { EvaluationRow } from "@/components/evaluation/EvaluationsSection";

export type OverviewTabKey =
  | "physical"
  | "availability"
  | "followup"
  | "assignment";

type NextSession = {
  date: string;
  theme: string | null;
  kind: string;
  teamName: string | null;
} | null;

export function PlayerOverviewSection({
  stats,
  unavailabilities,
  evaluations,
  nextSession,
  lastTestDate,
  onOpenTab,
}: {
  stats: {
    presenceRate: number | null;
    sessionsPresent: number;
    sessionsTotal: number;
    availabilityRate: number;
  };
  unavailabilities: Unavailability[];
  evaluations: EvaluationRow[];
  nextSession: NextSession;
  lastTestDate: string | null;
  onOpenTab: (tab: OverviewTabKey) => void;
}) {
  const t = useTranslations("playerOverview");
  const tMed = useTranslations("availability");

  const today = new Date().toISOString().slice(0, 10);
  const active = useMemo(
    () => activeUnavailability(unavailabilities, today),
    [unavailabilities, today],
  );
  const ongoing = useMemo(
    () =>
      unavailabilities
        .filter((u) => u.startDate <= today && (u.endDate === null || u.endDate >= today))
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [unavailabilities, today],
  );
  const lastReport = evaluations[0] ?? null;

  // Timeline fusionnée (indispos + suivis TIPS), du plus récent au plus ancien.
  const timeline = useMemo(() => {
    const events: { date: string; icon: "injury" | "report"; label: string }[] = [];
    for (const u of unavailabilities) {
      events.push({
        date: u.startDate,
        icon: "injury",
        label: `${tMed(`kind.${u.kind}`)}${u.reason ? ` — ${u.reason}` : ""}`,
      });
    }
    for (const e of evaluations) {
      if (e.evaluation_date) {
        events.push({
          date: e.evaluation_date,
          icon: "report",
          label: t("timeline.report"),
        });
      }
    }
    return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, [unavailabilities, evaluations, t, tMed]);

  return (
    <div className="flex flex-col gap-4">
      {/* Statut de disponibilité */}
      <Section className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                active
                  ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                  : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
              }`}
            >
              <HeartPulse className="h-5 w-5" />
            </span>
            <div>
              {active ? (
                <div className="flex items-center gap-2">
                  <KindBadge kind={active.kind} label={tMed(`kind.${active.kind}`)} />
                  <span className="text-[13px] text-muted-foreground">
                    {t("status.since", { date: formatDay(active.startDate) })}
                    {active.endDate
                      ? ` · ${t("status.until", { date: formatDay(active.endDate) })}`
                      : ""}
                  </span>
                </div>
              ) : (
                <span className="text-[15px] font-semibold text-emerald-700 dark:text-emerald-300">
                  {t("status.available")}
                </span>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi
          label={t("kpi.presence")}
          value={stats.presenceRate === null ? "—" : `${Math.round(stats.presenceRate * 100)}%`}
        />
        <Kpi label={t("kpi.sessions")} value={`${stats.sessionsPresent}/${stats.sessionsTotal}`} />
        <Kpi label={t("kpi.availability")} value={`${Math.round(stats.availabilityRate * 100)}%`} />
      </div>

      {/* Cartes raccourcis */}
      <div className="grid gap-3 sm:grid-cols-2">
        <OverviewCard
          icon={CalendarDays}
          title={t("card.nextSession")}
          onClick={() => onOpenTab("assignment")}
        >
          {nextSession ? (
            <div>
              <div className="font-medium text-foreground">
                {formatDay(nextSession.date)}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {[nextSession.teamName, nextSession.theme].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground">{t("card.nextSessionEmpty")}</span>
          )}
        </OverviewCard>

        <OverviewCard
          icon={Activity}
          title={t("card.lastTest")}
          onClick={() => onOpenTab("physical")}
        >
          {lastTestDate ? (
            <span className="font-medium text-foreground">
              {formatDay(lastTestDate)}
            </span>
          ) : (
            <span className="text-[13px] text-muted-foreground">{t("card.lastTestEmpty")}</span>
          )}
        </OverviewCard>

        <OverviewCard
          icon={ClipboardList}
          title={t("card.lastReport")}
          onClick={() => onOpenTab("followup")}
        >
          {lastReport ? (
            <div>
              <div className="font-medium text-foreground">
                {lastReport.evaluation_date
                  ? formatDay(lastReport.evaluation_date)
                  : t("card.lastReportEmpty")}
              </div>
              {lastReport.average !== null ? (
                <div className="text-[12px] text-muted-foreground">
                  {t("card.average", { value: lastReport.average.toFixed(2) })}
                </div>
              ) : null}
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground">{t("card.lastReportEmpty")}</span>
          )}
        </OverviewCard>

        <OverviewCard
          icon={HeartPulse}
          title={t("card.injuries")}
          onClick={() => onOpenTab("availability")}
        >
          {ongoing.length === 0 ? (
            <span className="text-[13px] text-muted-foreground">{t("card.injuriesNone")}</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {ongoing.map((u) => (
                <KindBadge key={u.id} kind={u.kind} label={tMed(`kind.${u.kind}`)} />
              ))}
            </div>
          )}
        </OverviewCard>
      </div>

      {/* Timeline */}
      <Section className="!p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {t("timeline.title")}
          </h3>
        </div>
        {timeline.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">{t("timeline.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {timeline.map((ev, i) => (
              <li key={i} className="flex items-center gap-3 text-[13px]">
                <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground">
                  {formatDay(ev.date)}
                </span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    ev.icon === "injury"
                      ? "bg-red-50 text-red-500 dark:bg-red-950/30"
                      : "bg-accent text-primary"
                  }`}
                >
                  {ev.icon === "injury" ? (
                    <HeartPulse className="h-3.5 w-3.5" />
                  ) : (
                    <ClipboardList className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="text-foreground">{ev.label}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

function OverviewCard({
  icon: Icon,
  title,
  onClick,
  children,
}: {
  icon: typeof Activity;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </button>
  );
}
