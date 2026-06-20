"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarPlus,
  LineChart as LineChartIcon,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/Section";
import { formatDay, todayISO } from "@/lib/contingent/week";
import {
  archiveMetricAction,
  createMetricAction,
  updateMetricAction,
  upsertMeasurementAction,
} from "@/app/[locale]/(app)/contingent/[playerId]/physical/actions";

export type PhysicalMetric = {
  id: string;
  name: string;
  unit: string | null;
  category: string | null;
  description: string | null;
  protocol: string | null;
  higher_is_better: boolean;
  sort_order: number;
  archived: boolean;
};

export type PhysicalMeasurement = {
  metric_id: string;
  measured_on: string;
  value: number | null;
  note: string | null;
};

type Point = { date: string; value: number };

function parseValue(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function fmt(value: number | null): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

type Trend = "up" | "down" | "flat";

function trendOf(
  first: number,
  last: number,
  higherIsBetter: boolean,
): { trend: Trend; color: string } {
  const delta = last - first;
  if (delta === 0) return { trend: "flat", color: "#a1a1aa" };
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return { trend: improved ? "up" : "down", color: improved ? "#16a34a" : "#dc2626" };
}

function TrendArrow({ trend, className }: { trend: Trend; className?: string }) {
  if (trend === "flat") return <ArrowRight className={className ?? "h-3.5 w-3.5 text-zinc-400"} />;
  if (trend === "up") return <ArrowUpRight className={className ?? "h-3.5 w-3.5 text-green-600"} />;
  return <ArrowDownRight className={className ?? "h-3.5 w-3.5 text-red-600"} />;
}

/** Petite courbe SVG maison (pas de lib de charting dans le repo). */
function Sparkline({ points, higherIsBetter }: { points: Point[]; higherIsBetter: boolean }) {
  if (points.length < 2) {
    return <span className="text-[11px] text-zinc-400">—</span>;
  }
  const W = 96;
  const H = 28;
  const PAD = 3;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (W - PAD * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = PAD + i * stepX;
    const y = PAD + (H - PAD * 2) * (1 - (p.value - min) / span);
    return { x, y };
  });
  const d = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const { trend, color } = trendOf(values[0], values[values.length - 1], higherIsBetter);

  return (
    <div className="flex items-center gap-1.5">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={1.4} fill={color} />
        ))}
      </svg>
      <TrendArrow trend={trend} />
    </div>
  );
}

/** Courbe plein format avec axes pour la modale d'un test. */
function MetricChart({
  points,
  unit,
  higherIsBetter,
}: {
  points: Point[];
  unit: string | null;
  higherIsBetter: boolean;
}) {
  const W = 520;
  const H = 240;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = (rawMax - rawMin) * 0.12 || Math.abs(rawMax) * 0.12 || 1;
  const min = rawMin - pad;
  const max = rawMax + pad;
  const span = max - min || 1;

  const x = (i: number) =>
    padL + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
  const y = (v: number) => padT + plotH * (1 - (v - min) / span);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");
  const { color } = trendOf(values[0], values[values.length - 1], higherIsBetter);

  const yTicks = Array.from({ length: 4 }, (_, i) => min + (span * i) / 3);
  const xStep = Math.ceil(points.length / 8);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" className="select-none">
      {yTicks.map((tv, i) => {
        const yy = y(tv);
        return (
          <g key={i}>
            <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="currentColor" className="text-zinc-200 dark:text-zinc-700" strokeWidth={1} />
            <text x={padL - 6} y={yy + 3} textAnchor="end" className="fill-zinc-400 text-[10px]">
              {Number(tv.toFixed(2))}
            </text>
          </g>
        );
      })}
      {points.map((p, i) =>
        i % xStep === 0 || i === points.length - 1 ? (
          <text key={p.date} x={x(i)} y={H - padB + 16} textAnchor="middle" className="fill-zinc-400 text-[10px]">
            {formatDay(p.date)}
          </text>
        ) : null,
      )}
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={x(i)} cy={y(p.value)} r={3} fill={color} />
          <text x={x(i)} y={y(p.value) - 8} textAnchor="middle" className="fill-zinc-500 text-[10px] dark:fill-zinc-400">
            {p.value}
          </text>
        </g>
      ))}
      {unit ? (
        <text x={padL - 6} y={padT - 4} textAnchor="end" className="fill-zinc-400 text-[10px]">
          {unit}
        </text>
      ) : null}
    </svg>
  );
}

type MetricDraft = {
  id?: string;
  name: string;
  unit: string;
  category: string;
  description: string;
  protocol: string;
  higherIsBetter: boolean;
};

function emptyDraft(): MetricDraft {
  return { name: "", unit: "", category: "", description: "", protocol: "", higherIsBetter: true };
}

export function PhysicalTrackingSection({
  playerId,
  locale,
  metrics,
  measurements,
  canManageMetrics,
  canRecord,
}: {
  playerId: string;
  locale: string;
  metrics: PhysicalMetric[];
  measurements: PhysicalMeasurement[];
  canManageMetrics: boolean;
  canRecord: boolean;
}) {
  const t = useTranslations("contingent.physical");
  const [pending, startTransition] = useTransition();
  const [managerOpen, setManagerOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<PhysicalMetric | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeMetrics = useMemo(
    () =>
      metrics
        .filter((m) => !m.archived)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [metrics],
  );

  // Index des mesures : `${metricId}|${date}` -> value
  const byKey = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const m of measurements) map.set(`${m.metric_id}|${m.measured_on}`, m.value);
    return map;
  }, [measurements]);

  // Série complète (triée) par test, pour sparkline + graphe.
  const seriesByMetric = useMemo(() => {
    const map = new Map<string, Point[]>();
    for (const m of [...measurements].sort((a, b) => a.measured_on.localeCompare(b.measured_on))) {
      if (m.value === null) continue;
      const arr = map.get(m.metric_id) ?? [];
      arr.push({ date: m.measured_on, value: m.value });
      map.set(m.metric_id, arr);
    }
    return map;
  }, [measurements]);

  // Colonnes = dates de test existantes ∪ dates ajoutées à la volée.
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const m of measurements) set.add(m.measured_on);
    for (const d of extraDates) set.add(d);
    return Array.from(set).sort();
  }, [measurements, extraDates]);

  function addDate(date: string) {
    if (!date) return;
    setExtraDates((prev) => (prev.includes(date) ? prev : [...prev, date]));
  }

  function commitCell(metricId: string, date: string, raw: string) {
    const value = parseValue(raw);
    const prev = byKey.get(`${metricId}|${date}`) ?? null;
    if (value === prev) return;
    setError(null);
    startTransition(async () => {
      const res = await upsertMeasurementAction({
        playerId,
        locale,
        metricId,
        measuredOn: date,
        value,
        note: null,
      });
      if (res?.error) setError(res.error);
    });
  }

  function saveMetric(metricDraft: MetricDraft) {
    setError(null);
    startTransition(async () => {
      const res = metricDraft.id
        ? await updateMetricAction({
            playerId,
            locale,
            metricId: metricDraft.id,
            name: metricDraft.name,
            unit: metricDraft.unit || null,
            category: metricDraft.category || null,
            description: metricDraft.description || null,
            protocol: metricDraft.protocol || null,
            higherIsBetter: metricDraft.higherIsBetter,
          })
        : await createMetricAction({
            playerId,
            locale,
            name: metricDraft.name,
            unit: metricDraft.unit || null,
            category: metricDraft.category || null,
            description: metricDraft.description || null,
            protocol: metricDraft.protocol || null,
            higherIsBetter: metricDraft.higherIsBetter,
          });
      if (res?.error) setError(res.error);
    });
  }

  function archiveMetric(metricId: string, archived: boolean) {
    startTransition(async () => {
      const res = await archiveMetricAction({ playerId, locale, metricId, archived });
      if (res?.error) setError(res.error);
    });
  }

  const today = todayISO();

  return (
    <Section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionHeader icon={Activity} title={t("title")} />
        {canManageMetrics ? (
          <button
            type="button"
            onClick={() => setManagerOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--club-line)] px-3 py-1.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800/50"
          >
            <Settings2 className="h-4 w-4" />
            {t("manage")}
          </button>
        ) : null}
      </div>

      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{t("intro")}</p>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {activeMetrics.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--club-line)] p-8 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("empty")}</p>
          {canManageMetrics ? (
            <button
              type="button"
              onClick={() => setManagerOpen(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-[var(--club-primary)] px-3 py-1.5 text-[13px] font-semibold text-[var(--club-primary-foreground)]"
            >
              <Plus className="h-4 w-4" />
              {t("createFirst")}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {/* ---- Barre d'action : ajouter une date de test ---- */}
          {canRecord ? (
            <div className="mb-2 flex items-center justify-end">
              <AddDateButton t={t} today={today} onAdd={addDate} />
            </div>
          ) : null}

          {/* ---- Grille tests × dates ---- */}
          {dates.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--club-line)] p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t("noDates")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--club-line)] text-left">
                    <th className="sticky left-0 z-10 bg-white py-2 pr-3 dark:bg-zinc-900" />
                    {dates.map((d) => {
                      const isToday = d === today;
                      return (
                        <th
                          key={d}
                          className={`px-2 py-2 text-center text-[11px] font-mono font-medium uppercase tracking-wide ${
                            isToday ? "text-[var(--club-primary)]" : "text-zinc-500"
                          }`}
                        >
                          {formatDay(d)}
                        </th>
                      );
                    })}
                    <th className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                      {t("trend")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeMetrics.map((metric) => {
                    const series = seriesByMetric.get(metric.id) ?? [];
                    return (
                      <tr key={metric.id} className="border-b border-[var(--club-line)]/60">
                        <td className="sticky left-0 z-10 bg-white py-2 pr-3 dark:bg-zinc-900">
                          <button
                            type="button"
                            onClick={() => setChartMetric(metric)}
                            title={t("viewChart")}
                            className="group flex items-center gap-1.5 text-left"
                          >
                            <span className="font-medium text-zinc-900 group-hover:text-[var(--club-primary)] dark:text-zinc-100">
                              {metric.name}
                            </span>
                            <LineChartIcon className="h-3.5 w-3.5 text-zinc-300 group-hover:text-[var(--club-primary)]" />
                          </button>
                          {(metric.unit || metric.category) && (
                            <div className="text-[11px] text-zinc-400">
                              {[metric.category, metric.unit].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </td>
                        {dates.map((d) => {
                          const key = `${metric.id}|${d}`;
                          const val = byKey.get(key) ?? null;
                          const isToday = d === today;
                          return (
                            <td
                              key={d}
                              className={`px-1 py-1 text-center ${isToday ? "bg-[var(--club-primary)]/5" : ""}`}
                            >
                              {canRecord ? (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  key={key}
                                  defaultValue={fmt(val)}
                                  disabled={pending}
                                  onBlur={(e) => commitCell(metric.id, d, e.target.value)}
                                  className="w-16 rounded-md border border-transparent bg-zinc-50 px-2 py-1 text-center font-mono tabular-nums text-zinc-900 hover:border-[var(--club-line)] focus:border-[var(--club-primary)] focus:bg-white focus:outline-none dark:bg-zinc-800/50 dark:text-zinc-100 dark:focus:bg-zinc-800"
                                />
                              ) : (
                                <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                                  {fmt(val) || "—"}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-2 py-1">
                          <Sparkline points={series} higherIsBetter={metric.higher_is_better} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {managerOpen ? (
        <MetricManager
          t={t}
          metrics={metrics}
          pending={pending}
          onClose={() => setManagerOpen(false)}
          onSave={saveMetric}
          onArchive={archiveMetric}
        />
      ) : null}

      {chartMetric ? (
        <ChartModal
          t={t}
          metric={chartMetric}
          points={seriesByMetric.get(chartMetric.id) ?? []}
          onClose={() => setChartMetric(null)}
        />
      ) : null}
    </Section>
  );
}

function AddDateButton({
  t,
  today,
  onAdd,
}: {
  t: ReturnType<typeof useTranslations>;
  today: string;
  onAdd: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--club-line)] px-2.5 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        {t("addDate")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-md border border-[var(--club-line)] bg-white px-2 py-1 text-[13px] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <button
        type="button"
        onClick={() => {
          onAdd(date);
          setOpen(false);
        }}
        className="rounded-md bg-[var(--club-primary)] px-3 py-1.5 text-[12px] font-semibold text-[var(--club-primary-foreground)]"
      >
        {t("add")}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        aria-label={t("close")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ChartModal({
  t,
  metric,
  points,
  onClose,
}: {
  t: ReturnType<typeof useTranslations>;
  metric: PhysicalMetric;
  points: Point[];
  onClose: () => void;
}) {
  const hasEnough = points.length >= 2;
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  const delta = hasEnough ? last - first : 0;
  const { trend } = hasEnough
    ? trendOf(first, last, metric.higher_is_better)
    : { trend: "flat" as Trend };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-lg border border-[var(--club-line)] bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {metric.name}
              {metric.unit ? (
                <span className="ml-2 text-sm font-normal text-zinc-400">{metric.unit}</span>
              ) : null}
            </h3>
            {metric.description ? (
              <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">{metric.description}</p>
            ) : null}
            {hasEnough ? (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                <TrendArrow trend={trend} className="h-4 w-4" />
                <span className="font-mono tabular-nums">
                  {delta > 0 ? "+" : ""}
                  {Number(delta.toFixed(2))}
                </span>
                <span>{t("sinceStart", { date: formatDay(points[0].date) })}</span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            aria-label={t("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {points.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-400">{t("noData")}</p>
        ) : (
          <MetricChart points={points} unit={metric.unit} higherIsBetter={metric.higher_is_better} />
        )}

        {metric.protocol ? (
          <div className="mt-4 rounded-md border border-[var(--club-line)] bg-zinc-50/60 p-3 dark:bg-zinc-800/30">
            <div className="mb-1 text-[11px] font-mono uppercase tracking-widest text-zinc-500">
              {t("field.protocol")}
            </div>
            <p className="whitespace-pre-wrap text-[13px] text-zinc-700 dark:text-zinc-300">
              {metric.protocol}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetricManager({
  t,
  metrics,
  pending,
  onClose,
  onSave,
  onArchive,
}: {
  t: ReturnType<typeof useTranslations>;
  metrics: PhysicalMetric[];
  pending: boolean;
  onClose: () => void;
  onSave: (draft: MetricDraft) => void;
  onArchive: (metricId: string, archived: boolean) => void;
}) {
  const [draft, setDraft] = useState<MetricDraft>(emptyDraft());
  const active = metrics.filter((m) => !m.archived);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[var(--club-line)] bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t("manage")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            aria-label={t("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {active.length > 0 ? (
          <ul className="mb-4 flex flex-col gap-1.5">
            {active.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-md border border-[var(--club-line)] px-3 py-2"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() =>
                    setDraft({
                      id: m.id,
                      name: m.name,
                      unit: m.unit ?? "",
                      category: m.category ?? "",
                      description: m.description ?? "",
                      protocol: m.protocol ?? "",
                      higherIsBetter: m.higher_is_better,
                    })
                  }
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{m.name}</span>
                  {(m.unit || m.category) && (
                    <span className="ml-2 text-[11px] text-zinc-400">
                      {[m.category, m.unit].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onArchive(m.id, true)}
                  title={t("archive")}
                  className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="rounded-md border border-[var(--club-line)] bg-zinc-50/60 p-3 dark:bg-zinc-800/30">
          <div className="mb-3 text-[11px] font-mono uppercase tracking-widest text-zinc-500">
            {draft.id ? t("editMetric") : t("newMetric")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {t("field.name")}
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder={t("field.namePlaceholder")}
                className="rounded-md border border-[var(--club-line)] bg-white px-2 py-1.5 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {t("field.unit")}
              <input
                value={draft.unit}
                onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                placeholder={t("field.unitPlaceholder")}
                className="rounded-md border border-[var(--club-line)] bg-white px-2 py-1.5 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {t("field.category")}
              <input
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                placeholder={t("field.categoryPlaceholder")}
                className="rounded-md border border-[var(--club-line)] bg-white px-2 py-1.5 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {t("field.description")}
              <input
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder={t("field.descriptionPlaceholder")}
                className="rounded-md border border-[var(--club-line)] bg-white px-2 py-1.5 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {t("field.protocol")}
              <textarea
                value={draft.protocol}
                onChange={(e) => setDraft((d) => ({ ...d, protocol: e.target.value }))}
                placeholder={t("field.protocolPlaceholder")}
                rows={3}
                className="rounded-md border border-[var(--club-line)] bg-white px-2 py-1.5 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="col-span-2 flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={draft.higherIsBetter}
                onChange={(e) => setDraft((d) => ({ ...d, higherIsBetter: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300"
              />
              {t("field.higherIsBetter")}
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {draft.id ? (
              <button
                type="button"
                onClick={() => setDraft(emptyDraft())}
                className="rounded-md px-3 py-1.5 text-[13px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                {t("cancelEdit")}
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending || !draft.name.trim()}
              onClick={() => {
                onSave(draft);
                setDraft(emptyDraft());
              }}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--club-primary)] px-3 py-1.5 text-[13px] font-semibold text-[var(--club-primary-foreground)] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {draft.id ? t("save") : t("add")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
