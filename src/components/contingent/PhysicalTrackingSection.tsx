"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Archive,
  LineChart as LineChartIcon,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/Section";
import { formatDay, todayISO } from "@/lib/contingent/week";
import {
  fmt,
  MetricChart,
  parseValue,
  type Point,
  Sparkline,
  type Trend,
  TrendArrow,
  trendOf,
} from "@/components/physical/charts";
import {
  archiveMetricAction,
  createMetricAction,
  updateMetricAction,
  upsertMeasurementAction,
} from "@/app/[locale]/(app)/contingent/[playerId]/physical/actions";
import type { MetricFields } from "@/lib/physical/defaultLibrary";

export type { MetricFields };

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
  // Métadonnées bibliothèque (peuvent être absentes pour d'anciens indicateurs).
  subcategory?: string | null;
  value_type?: string | null;
  interpretation?: string | null;
  material?: string[] | null;
  trials?: string | null;
  validity_conditions?: string | null;
  recommended_frequency?: string | null;
  display?: string | null;
  alert_threshold?: number | null;
  default_key?: string | null;
};

export type PhysicalMeasurement = {
  metric_id: string;
  measured_on: string;
  value: number | null;
  note: string | null;
};

export type MetricDraft = {
  id?: string;
  name: string;
  category: string; // physical | technical | medical
  subcategory: string;
  unit: string;
  valueType: string; // integer | decimal | percentage | score | number
  interpretation: string; // higher | lower | target
  description: string;
  protocol: string;
  material: string; // saisie libre, séparée par des virgules
  trials: string;
  validityConditions: string;
  recommendedFrequency: string;
  display: string; // primary | secondary
  alertThreshold: string; // texte → numérique | null
};

function emptyDraft(): MetricDraft {
  return {
    name: "",
    category: "physical",
    subcategory: "",
    unit: "",
    valueType: "number",
    interpretation: "higher",
    description: "",
    protocol: "",
    material: "",
    trials: "",
    validityConditions: "",
    recommendedFrequency: "",
    display: "primary",
    alertThreshold: "",
  };
}

function draftFromMetric(m: PhysicalMetric): MetricDraft {
  return {
    id: m.id,
    name: m.name,
    category: m.category ?? "physical",
    subcategory: m.subcategory ?? "",
    unit: m.unit ?? "",
    valueType: m.value_type ?? "number",
    interpretation: m.interpretation ?? (m.higher_is_better ? "higher" : "lower"),
    description: m.description ?? "",
    protocol: m.protocol ?? "",
    material: (m.material ?? []).join(", "),
    trials: m.trials ?? "",
    validityConditions: m.validity_conditions ?? "",
    recommendedFrequency: m.recommended_frequency ?? "",
    display: m.display ?? "primary",
    alertThreshold:
      m.alert_threshold !== null && m.alert_threshold !== undefined
        ? String(m.alert_threshold)
        : "",
  };
}

const CATEGORY_OPTIONS = ["physical", "technical", "medical"] as const;
const VALUE_TYPE_OPTIONS = ["integer", "decimal", "percentage", "score", "number"] as const;
const INTERPRETATION_OPTIONS = ["higher", "lower", "target"] as const;
const DISPLAY_OPTIONS = ["primary", "secondary"] as const;

export function metricFieldsFromDraft(draft: MetricDraft): MetricFields {
  const thr = draft.alertThreshold.trim().replace(",", ".");
  const alertThreshold =
    thr === "" ? null : Number.isFinite(Number(thr)) ? Number(thr) : null;
  const material = draft.material
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    name: draft.name.trim(),
    category: draft.category.trim() || null,
    subcategory: draft.subcategory.trim() || null,
    unit: draft.unit.trim() || null,
    valueType: draft.valueType || null,
    interpretation: draft.interpretation || "higher",
    description: draft.description.trim() || null,
    protocol: draft.protocol.trim() || null,
    material: material.length ? material : null,
    trials: draft.trials.trim() || null,
    validityConditions: draft.validityConditions.trim() || null,
    recommendedFrequency: draft.recommendedFrequency.trim() || null,
    display: draft.display || "primary",
    alertThreshold,
  };
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

  // Colonnes = dates de test existantes. La saisie est pilotée par les évals
  // (page Évaluation / planning) : pas d'ajout de date ad-hoc depuis la fiche.
  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const m of measurements) set.add(m.measured_on);
    return Array.from(set).sort();
  }, [measurements]);

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
    const fields = metricFieldsFromDraft(metricDraft);
    startTransition(async () => {
      const res = metricDraft.id
        ? await updateMetricAction({ playerId, locale, metricId: metricDraft.id, fields })
        : await createMetricAction({ playerId, locale, fields });
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

const FORM_FIELD =
  "rounded-md border border-[var(--club-line)] bg-white px-2 py-1.5 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100";
const FORM_LABEL =
  "flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300";

export function MetricManager({
  t,
  metrics,
  pending,
  onClose,
  onSave,
  onArchive,
  onDelete,
}: {
  t: ReturnType<typeof useTranslations>;
  metrics: PhysicalMetric[];
  pending: boolean;
  onClose: () => void;
  onSave: (draft: MetricDraft) => void;
  onArchive: (metricId: string, archived: boolean) => void;
  // Suppression définitive (indicateurs personnalisés uniquement). Optionnel :
  // absent côté fiche joueur, fourni depuis la page Évaluation.
  onDelete?: (metricId: string) => void;
}) {
  const [draft, setDraft] = useState<MetricDraft | null>(null);

  const sorted = useMemo(
    () =>
      [...metrics].sort(
        (a, b) =>
          Number(a.archived) - Number(b.archived) ||
          a.sort_order - b.sort_order ||
          a.name.localeCompare(b.name),
      ),
    [metrics],
  );

  function set<K extends keyof MetricDraft>(key: K, value: MetricDraft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[var(--club-line)] bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t("manage")}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft(emptyDraft())}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--club-primary)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--club-primary-foreground)]"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("newMetric")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              aria-label={t("close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ---- Formulaire de création / édition (fluide, façon wizard) ---- */}
        {draft ? (
          <MetricForm
            t={t}
            draft={draft}
            pending={pending}
            set={set}
            onCancel={() => setDraft(null)}
            onSubmit={() => {
              onSave(draft);
              setDraft(null);
            }}
          />
        ) : null}

        {/* ---- Tableau compact des tests ---- */}
        <div className="overflow-hidden rounded-md border border-[var(--club-line)]">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">{t("table.name")}</th>
                <th className="px-3 py-2 font-medium">{t("table.category")}</th>
                <th className="px-3 py-2 font-medium">{t("table.unit")}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--club-line)]">
              {sorted.map((m) => (
                <tr
                  key={m.id}
                  className={m.archived ? "opacity-50" : "bg-white dark:bg-zinc-900"}
                >
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => setDraft(draftFromMetric(m))}
                      className="text-left font-medium text-zinc-900 hover:text-[var(--club-primary)] dark:text-zinc-100"
                    >
                      {m.name}
                    </button>
                  </td>
                  <td className="px-3 py-1.5 text-[12px] text-zinc-500">
                    {m.category
                      ? (CATEGORY_OPTIONS as readonly string[]).includes(m.category)
                        ? t(`field.categoryOption.${m.category}`)
                        : m.category
                      : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-[12px] text-zinc-500">{m.unit || "—"}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      {m.archived ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onArchive(m.id, false)}
                          className="rounded-md px-2 py-1 text-[12px] font-semibold text-[var(--club-primary)] hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        >
                          {t("restore")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onArchive(m.id, true)}
                          title={t("archive")}
                          aria-label={t("archive")}
                          className="rounded-md p-1 text-zinc-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                      {/* Suppression définitive : indicateurs personnalisés seulement. */}
                      {onDelete && !m.default_key ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(t("deleteConfirm"))) onDelete(m.id);
                          }}
                          title={t("delete")}
                          aria-label={t("delete")}
                          className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-400">
                    {t("empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricForm({
  t,
  draft,
  pending,
  set,
  onCancel,
  onSubmit,
}: {
  t: ReturnType<typeof useTranslations>;
  draft: MetricDraft;
  pending: boolean;
  set: <K extends keyof MetricDraft>(key: K, value: MetricDraft[K]) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mb-4 rounded-md border border-[var(--club-line)] bg-zinc-50/60 p-3 dark:bg-zinc-800/30">
      <div className="mb-3 text-[11px] font-mono uppercase tracking-widest text-zinc-500">
        {draft.id ? t("editMetric") : t("newMetric")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={`col-span-2 ${FORM_LABEL}`}>
          {t("field.name")}
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t("field.namePlaceholder")}
            className={FORM_FIELD}
          />
        </label>
        <label className={FORM_LABEL}>
          {t("field.category")}
          <select
            value={draft.category}
            onChange={(e) => set("category", e.target.value)}
            className={FORM_FIELD}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {t(`field.categoryOption.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={FORM_LABEL}>
          {t("field.subcategory")}
          <input
            value={draft.subcategory}
            onChange={(e) => set("subcategory", e.target.value)}
            placeholder={t("field.subcategoryPlaceholder")}
            className={FORM_FIELD}
          />
        </label>
        <label className={FORM_LABEL}>
          {t("field.unit")}
          <input
            value={draft.unit}
            onChange={(e) => set("unit", e.target.value)}
            placeholder={t("field.unitPlaceholder")}
            className={FORM_FIELD}
          />
        </label>
        <label className={FORM_LABEL}>
          {t("field.valueType")}
          <select
            value={draft.valueType}
            onChange={(e) => set("valueType", e.target.value)}
            className={FORM_FIELD}
          >
            {VALUE_TYPE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {t(`field.valueTypeOption.${v}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={FORM_LABEL}>
          {t("field.interpretation")}
          <select
            value={draft.interpretation}
            onChange={(e) => set("interpretation", e.target.value)}
            className={FORM_FIELD}
          >
            {INTERPRETATION_OPTIONS.map((i) => (
              <option key={i} value={i}>
                {t(`field.interpretationOption.${i}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={FORM_LABEL}>
          {t("field.display")}
          <select
            value={draft.display}
            onChange={(e) => set("display", e.target.value)}
            className={FORM_FIELD}
          >
            {DISPLAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {t(`field.displayOption.${d}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={FORM_LABEL}>
          {t("field.alertThreshold")}
          <input
            value={draft.alertThreshold}
            onChange={(e) => set("alertThreshold", e.target.value)}
            inputMode="decimal"
            placeholder={t("field.alertThresholdPlaceholder")}
            className={FORM_FIELD}
          />
        </label>
        <label className={`col-span-2 ${FORM_LABEL}`}>
          {t("field.description")}
          <input
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={t("field.descriptionPlaceholder")}
            className={FORM_FIELD}
          />
        </label>
        <label className={`col-span-2 ${FORM_LABEL}`}>
          {t("field.protocol")}
          <textarea
            value={draft.protocol}
            onChange={(e) => set("protocol", e.target.value)}
            placeholder={t("field.protocolPlaceholder")}
            rows={3}
            className={FORM_FIELD}
          />
        </label>
        <label className={`col-span-2 ${FORM_LABEL}`}>
          {t("field.material")}
          <input
            value={draft.material}
            onChange={(e) => set("material", e.target.value)}
            placeholder={t("field.materialPlaceholder")}
            className={FORM_FIELD}
          />
        </label>
        <label className={FORM_LABEL}>
          {t("field.trials")}
          <input
            value={draft.trials}
            onChange={(e) => set("trials", e.target.value)}
            placeholder={t("field.trialsPlaceholder")}
            className={FORM_FIELD}
          />
        </label>
        <label className={FORM_LABEL}>
          {t("field.frequency")}
          <input
            value={draft.recommendedFrequency}
            onChange={(e) => set("recommendedFrequency", e.target.value)}
            placeholder={t("field.frequencyPlaceholder")}
            className={FORM_FIELD}
          />
        </label>
        <label className={`col-span-2 ${FORM_LABEL}`}>
          {t("field.validity")}
          <input
            value={draft.validityConditions}
            onChange={(e) => set("validityConditions", e.target.value)}
            placeholder={t("field.validityPlaceholder")}
            className={FORM_FIELD}
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-[13px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {t("cancelEdit")}
        </button>
        <button
          type="button"
          disabled={pending || !draft.name.trim()}
          onClick={onSubmit}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--club-primary)] px-3 py-1.5 text-[13px] font-semibold text-[var(--club-primary-foreground)] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {draft.id ? t("save") : t("add")}
        </button>
      </div>
    </div>
  );
}
