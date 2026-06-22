"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Activity, ChevronDown, ChevronRight, Download, LineChart as LineChartIcon, Plus, Settings2, Trash2, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Section, SectionHeader } from "@/components/ui/Section";
import { formatDay } from "@/lib/contingent/week";
import {
  MetricChart,
  type Point,
  type Trend,
  TrendArrow,
  trendOf,
} from "@/components/physical/charts";
import {
  MetricManager,
  type MetricDraft,
  metricFieldsFromDraft,
  type PhysicalMetric,
} from "@/components/contingent/PhysicalTrackingSection";
import {
  archiveClubMetricAction,
  createClubMetricAction,
  deleteClubMetricAction,
  deletePhysicalTestAction,
  updateClubMetricAction,
} from "@/app/[locale]/(app)/tracking/actions";
import { createPhysicalTestAction } from "@/app/[locale]/(app)/planner/actions";

export type HubPlayer = {
  id: string;
  name: string;
  teamIds: string[];
};

export type HubMeasurement = {
  playerId: string;
  metricId: string;
  measuredOn: string;
  value: number;
};

export type HubEval = {
  id: string;
  teamId: string;
  teamName: string;
  date: string;
  testCount: number;
  /** Taux de complétion des saisies (0–1). */
  completion: number;
};

type Period = "all" | "12m" | "6m" | "3m";

type RankRow = {
  playerId: string;
  name: string;
  latest: number;
  latestDate: string;
  trend: Trend;
  delta: number | null;
  count: number;
};

function cutoffFor(period: Period): string | null {
  if (period === "all") return null;
  const months = period === "12m" ? 12 : period === "6m" ? 6 : 3;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

export function PhysicalHubView({
  locale,
  metrics,
  players,
  measurements,
  teams,
  evals = [],
  canManageMetrics,
}: {
  locale: string;
  metrics: PhysicalMetric[];
  players: HubPlayer[];
  measurements: HubMeasurement[];
  teams: { id: string; name: string }[];
  evals?: HubEval[];
  canManageMetrics: boolean;
}) {
  const t = useTranslations("physicalHub");
  const tm = useTranslations("contingent.physical");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [chartPlayerId, setChartPlayerId] = useState<string | null>(null);
  const [createEvalOpen, setCreateEvalOpen] = useState(false);

  const activeMetrics = useMemo(
    () =>
      metrics
        .filter((m) => !m.archived)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [metrics],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(activeMetrics.map((m) => m.category?.trim()).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b)),
    [activeMetrics],
  );

  const [metricId, setMetricId] = useState<string>(activeMetrics[0]?.id ?? "");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [period, setPeriod] = useState<Period>("all");

  // Si le filtre catégorie masque le test courant, on bascule sur le 1er visible.
  const metricsForCategory = useMemo(
    () =>
      categoryFilter
        ? activeMetrics.filter((m) => (m.category?.trim() ?? "") === categoryFilter)
        : activeMetrics,
    [activeMetrics, categoryFilter],
  );

  const effectiveMetricId =
    metricsForCategory.some((m) => m.id === metricId)
      ? metricId
      : metricsForCategory[0]?.id ?? "";
  const metric = activeMetrics.find((m) => m.id === effectiveMetricId) ?? null;

  const playerName = useMemo(
    () => new Map(players.map((p) => [p.id, p.name])),
    [players],
  );

  // Joueurs retenus selon le filtre équipe (saison active côté serveur).
  const eligiblePlayerIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) {
      if (!teamFilter || p.teamIds.includes(teamFilter)) set.add(p.id);
    }
    return set;
  }, [players, teamFilter]);

  const cutoff = cutoffFor(period);

  // Points par joueur pour le test choisi, dans la période et l'équipe.
  const pointsByPlayer = useMemo(() => {
    const map = new Map<string, Point[]>();
    if (!metric) return map;
    for (const m of measurements) {
      if (m.metricId !== metric.id) continue;
      if (!eligiblePlayerIds.has(m.playerId)) continue;
      if (cutoff && m.measuredOn < cutoff) continue;
      const arr = map.get(m.playerId) ?? [];
      arr.push({ date: m.measuredOn, value: m.value });
      map.set(m.playerId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
    return map;
  }, [measurements, metric, eligiblePlayerIds, cutoff]);

  const ranking = useMemo<RankRow[]>(() => {
    if (!metric) return [];
    const rows: RankRow[] = [];
    for (const [playerId, pts] of pointsByPlayer) {
      if (pts.length === 0) continue;
      const latest = pts[pts.length - 1];
      const prev = pts.length >= 2 ? pts[pts.length - 2] : null;
      const { trend } = prev
        ? trendOf(prev.value, latest.value, metric.higher_is_better)
        : { trend: "flat" as Trend };
      rows.push({
        playerId,
        name: playerName.get(playerId) ?? "—",
        latest: latest.value,
        latestDate: latest.date,
        trend,
        delta: prev ? Number((latest.value - prev.value).toFixed(2)) : null,
        count: pts.length,
      });
    }
    rows.sort((a, b) =>
      metric.higher_is_better ? b.latest - a.latest : a.latest - b.latest,
    );
    return rows;
  }, [pointsByPlayer, metric, playerName]);

  const stats = useMemo(() => {
    if (ranking.length === 0) return null;
    const vals = ranking.map((r) => r.latest);
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      count: ranking.length,
      avg: Number((sum / vals.length).toFixed(2)),
      best: metric?.higher_is_better ? Math.max(...vals) : Math.min(...vals),
      worst: metric?.higher_is_better ? Math.min(...vals) : Math.max(...vals),
    };
  }, [ranking, metric]);

  function saveMetric(draft: MetricDraft) {
    setError(null);
    const fields = metricFieldsFromDraft(draft);
    startTransition(async () => {
      const res = draft.id
        ? await updateClubMetricAction({ locale, metricId: draft.id, fields })
        : await createClubMetricAction({ locale, fields });
      if (res?.error) setError(res.error);
    });
  }

  function archiveMetric(id: string, archived: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await archiveClubMetricAction({ locale, metricId: id, archived });
      if (res?.error) setError(res.error);
    });
  }

  function deleteMetric(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteClubMetricAction({ locale, metricId: id });
      if (res?.error) setError(res.error);
    });
  }

  function deleteEval(id: string) {
    if (!window.confirm(t("evals.deleteConfirm"))) return;
    setError(null);
    startTransition(async () => {
      const res = await deletePhysicalTestAction({ locale, sessionId: id });
      if (res?.error) setError(res.error);
    });
  }

  function createEval(teamId: string, date: string, metricIds: string[]) {
    setError(null);
    startTransition(async () => {
      // Succès → redirection serveur vers la page de saisie de l'éval.
      const res = await createPhysicalTestAction({ locale, teamId, date, metricIds });
      if (res?.error) setError(res.error);
      else setCreateEvalOpen(false);
    });
  }

  // Couleur de la valeur selon le seuil d'alerte (prioritaire) puis vs moyenne.
  function valueClass(value: number): string {
    if (!metric) return "text-zinc-900 dark:text-zinc-100";
    const thr = metric.alert_threshold;
    if (thr !== null && thr !== undefined) {
      const beyond = metric.higher_is_better ? value < thr : value > thr;
      if (beyond) return "text-red-600 dark:text-red-400";
    }
    if (stats) {
      const better = metric.higher_is_better ? value >= stats.avg : value <= stats.avg;
      return better
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-zinc-500 dark:text-zinc-400";
    }
    return "text-zinc-900 dark:text-zinc-100";
  }

  function exportCsv() {
    if (!metric) return;
    const header = [t("col.player"), t("col.value"), "Δ", t("col.date"), t("col.tests")];
    const lines = ranking.map((r) =>
      [r.name, r.latest, r.delta ?? "", r.latestDate, r.count]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${metric.name.replace(/[^\w-]+/g, "_")}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function categoryLabel(cat: string): string {
    if (cat === "physical" || cat === "technical" || cat === "medical") {
      return t(`library.category.${cat}`);
    }
    return cat;
  }

  const selectClass =
    "rounded-md border border-[var(--club-line)] bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100";

  // -- État vide : aucun test ------------------------------------------------
  if (activeMetrics.length === 0) {
    return (
      <Section>
        <div className="rounded-md border border-dashed border-[var(--club-line)] p-10 text-center">
          <Activity className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("emptyMetrics")}</p>
          {canManageMetrics ? (
            <button
              type="button"
              onClick={() => setManagerOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-[var(--club-primary)] px-3 py-1.5 text-[13px] font-semibold text-[var(--club-primary-foreground)]"
            >
              <Settings2 className="h-4 w-4" />
              {t("createFirst")}
            </button>
          ) : null}
        </div>
        {managerOpen ? (
          <MetricManager
            t={tm}
            metrics={metrics}
            pending={pending}
            onClose={() => setManagerOpen(false)}
            onSave={saveMetric}
            onArchive={archiveMetric}
            onDelete={deleteMetric}
          />
        ) : null}
      </Section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {/* ---- Barre de filtres ---- */}
      <Section className="!p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {t("filter.test")}
            <select
              value={effectiveMetricId}
              onChange={(e) => setMetricId(e.target.value)}
              className={selectClass}
            >
              {metricsForCategory.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.unit ? ` (${m.unit})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {t("filter.team")}
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("filter.allTeams")}</option>
              {teams.map((tm2) => (
                <option key={tm2.id} value={tm2.id}>
                  {tm2.name}
                </option>
              ))}
            </select>
          </label>

          {categories.length > 0 ? (
            <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {t("filter.category")}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={selectClass}
              >
                <option value="">{t("filter.allCategories")}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {t("filter.period")}
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className={selectClass}
            >
              <option value="all">{t("period.all")}</option>
              <option value="12m">{t("period.12m")}</option>
              <option value="6m">{t("period.6m")}</option>
              <option value="3m">{t("period.3m")}</option>
            </select>
          </label>

          <div className="ml-auto flex items-center gap-2">
            {canManageMetrics && teams.length > 0 ? (
              <button
                type="button"
                onClick={() => setCreateEvalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--club-primary)] px-3 py-1.5 text-[13px] font-semibold text-[var(--club-primary-foreground)]"
              >
                <Plus className="h-4 w-4" />
                {t("createEval")}
              </button>
            ) : null}
            {canManageMetrics ? (
              <button
                type="button"
                onClick={() => setManagerOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-[var(--club-line)] px-3 py-1.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800/50"
              >
                <Settings2 className="h-4 w-4" />
                {t("manageTests")}
              </button>
            ) : null}
          </div>
        </div>
      </Section>

      {evals.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t("evals.title")}
            </h3>
          </div>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {evals.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-1 pr-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
              >
                <Link
                  href={`/planner/${e.teamId}/sessions/${e.id}/test`}
                  className="flex flex-1 items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[var(--club-primary)]" />
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {e.teamName}
                    </span>
                    <span className="text-[12px] text-zinc-400">{formatDay(e.date)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[12px] text-zinc-500">
                      {t("evals.testCount", { count: e.testCount })}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                        e.completion >= 1
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : e.completion > 0
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {Math.round(e.completion * 100)}%
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--club-primary)]">
                      {e.completion >= 1 ? t("evals.view") : t("evals.enter")}
                    </span>
                  </span>
                </Link>
                {canManageMetrics ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => deleteEval(e.id)}
                    title={t("evals.delete")}
                    aria-label={t("evals.delete")}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {metric ? (
        <>
          {/* ---- En-tête test : description + protocole + métadonnées ---- */}
          <Section className="!p-4">
            <SectionHeader
              icon={Activity}
              title={
                <>
                  {metric.name}
                  {metric.unit ? (
                    <span className="ml-2 text-sm font-normal text-zinc-400">{metric.unit}</span>
                  ) : null}
                  {metric.category ? (
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {categoryLabel(metric.category)}
                      {metric.subcategory ? ` · ${metric.subcategory.replace(/_/g, " ")}` : ""}
                    </span>
                  ) : null}
                </>
              }
              description={metric.description ?? undefined}
            />

            {/* Métadonnées d'interprétation */}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-3">
              {metric.trials ? (
                <MetaItem label={t("meta.trials")} value={metric.trials} />
              ) : null}
              {metric.recommended_frequency ? (
                <MetaItem label={t("meta.frequency")} value={metric.recommended_frequency} />
              ) : null}
              {metric.material && metric.material.length > 0 ? (
                <MetaItem label={t("meta.material")} value={metric.material.join(", ")} />
              ) : null}
              {metric.alert_threshold !== null && metric.alert_threshold !== undefined ? (
                <MetaItem
                  label={t("meta.alertThreshold")}
                  value={`${metric.alert_threshold}${metric.unit ? ` ${metric.unit}` : ""}`}
                  alert
                />
              ) : null}
            </dl>

            {metric.validity_conditions ? (
              <p className="mt-3 text-[12px] text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold">{t("meta.validity")} : </span>
                {metric.validity_conditions}
              </p>
            ) : null}

            {metric.protocol ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setProtocolOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  {protocolOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  {tm("field.protocol")}
                </button>
                {protocolOpen ? (
                  <p className="mt-2 whitespace-pre-wrap rounded-md border border-[var(--club-line)] bg-zinc-50/60 p-3 text-[13px] text-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-300">
                    {metric.protocol}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Section>

          {ranking.length === 0 ? (
            <Section>
              <p className="py-10 text-center text-sm text-zinc-400">{t("noData")}</p>
            </Section>
          ) : (
            <>
              {/* ---- Stats club ---- */}
              {stats ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label={t("stats.evaluated")} value={String(stats.count)} />
                  <StatCard
                    label={t("stats.average")}
                    value={`${stats.avg}${metric.unit ? ` ${metric.unit}` : ""}`}
                  />
                  <StatCard
                    label={t("stats.best")}
                    value={`${stats.best}${metric.unit ? ` ${metric.unit}` : ""}`}
                  />
                  <StatCard
                    label={t("stats.worst")}
                    value={`${stats.worst}${metric.unit ? ` ${metric.unit}` : ""}`}
                  />
                </div>
              ) : null}

              {/* ---- Classement (tableau propre, graphe par joueur au clic) ---- */}
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {t("ranking")}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="hidden text-[11px] text-zinc-400 sm:inline">
                      {t("clickRowHint")}
                    </span>
                    <button
                      type="button"
                      onClick={exportCsv}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--club-line)] px-2.5 py-1 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t("exportCsv")}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-widest text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">{t("col.player")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("col.value")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("col.trend")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("col.date")}</th>
                        <th className="px-3 py-2 text-right font-medium">{t("col.tests")}</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {ranking.map((r, i) => (
                        <tr
                          key={r.playerId}
                          onClick={() => setChartPlayerId(r.playerId)}
                          className="cursor-pointer bg-white transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900/60"
                        >
                          <td className="px-3 py-2 font-mono text-zinc-400">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                            {r.name}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono font-semibold tabular-nums ${valueClass(r.latest)}`}
                          >
                            {r.latest}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <TrendArrow trend={r.trend} />
                              {r.delta !== null && r.delta !== 0 ? (
                                <span className="font-mono text-[12px] tabular-nums text-zinc-500">
                                  {r.delta > 0 ? "+" : ""}
                                  {r.delta}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[12px] text-zinc-400">
                            {formatDay(r.latestDate)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[12px] text-zinc-400">
                            {r.count}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <LineChartIcon className="ml-auto h-3.5 w-3.5 text-zinc-300" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      ) : null}

      {chartPlayerId && metric ? (
        <PlayerChartModal
          locale={locale}
          playerId={chartPlayerId}
          playerName={playerName.get(chartPlayerId) ?? "—"}
          metric={metric}
          points={pointsByPlayer.get(chartPlayerId) ?? []}
          closeLabel={tm("close")}
          viewProfileLabel={t("viewProfile")}
          noDataLabel={t("noData")}
          onClose={() => setChartPlayerId(null)}
        />
      ) : null}

      {managerOpen ? (
        <MetricManager
          t={tm}
          metrics={metrics}
          pending={pending}
          onClose={() => setManagerOpen(false)}
          onSave={saveMetric}
          onArchive={archiveMetric}
          onDelete={deleteMetric}
        />
      ) : null}

      {createEvalOpen ? (
        <EvalCreateModal
          t={t}
          teams={teams}
          metrics={activeMetrics}
          pending={pending}
          onClose={() => setCreateEvalOpen(false)}
          onSubmit={createEval}
        />
      ) : null}
    </div>
  );
}

function EvalCreateModal({
  t,
  teams,
  metrics,
  pending,
  onClose,
  onSubmit,
}: {
  t: ReturnType<typeof useTranslations>;
  teams: { id: string; name: string }[];
  metrics: PhysicalMetric[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (teamId: string, date: string, metricIds: string[]) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(metrics.map((m) => m.id)),
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSubmit = teamId && date && selected.size > 0 && !pending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-[var(--club-line)] bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t("createEval")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            aria-label={t("evalForm.cancel")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {t("pickTeam")}
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-md border border-[var(--club-line)] bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {teams.map((tm2) => (
                <option key={tm2.id} value={tm2.id}>
                  {tm2.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {t("evalForm.date")}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-[var(--club-line)] bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {t("evalForm.tests")} ({selected.size})
            </span>
            <div className="max-h-48 overflow-y-auto rounded-md border border-[var(--club-line)] p-1">
              {metrics.length === 0 ? (
                <p className="p-2 text-[12px] text-zinc-400">{t("emptyMetrics")}</p>
              ) : (
                metrics.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-[13px] text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggle(m.id)}
                    />
                    {m.name}
                    {m.unit ? (
                      <span className="text-zinc-400">({m.unit})</span>
                    ) : null}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--club-line)] px-3 py-1.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/50"
          >
            {t("evalForm.cancel")}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(teamId, date, Array.from(selected))}
            className="rounded-md bg-[var(--club-primary)] px-3 py-1.5 text-[13px] font-semibold text-[var(--club-primary-foreground)] disabled:opacity-50"
          >
            {t("evalForm.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerChartModal({
  locale,
  playerId,
  playerName,
  metric,
  points,
  closeLabel,
  viewProfileLabel,
  noDataLabel,
  onClose,
}: {
  locale: string;
  playerId: string;
  playerName: string;
  metric: PhysicalMetric;
  points: Point[];
  closeLabel: string;
  viewProfileLabel: string;
  noDataLabel: string;
  onClose: () => void;
}) {
  void locale;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-lg border border-[var(--club-line)] bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{playerName}</h3>
            <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
              {metric.name}
              {metric.unit ? <span className="ml-1.5 text-zinc-400">{metric.unit}</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {points.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-400">{noDataLabel}</p>
        ) : (
          <MetricChart points={points} unit={metric.unit} higherIsBetter={metric.higher_is_better} />
        )}

        <div className="mt-4 flex justify-end">
          <Link
            href={`/contingent/${playerId}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--club-line)] px-3 py-1.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800/50"
          >
            {viewProfileLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetaItem({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd
        className={`text-[12px] ${
          alert
            ? "font-semibold text-amber-600 dark:text-amber-400"
            : "text-zinc-700 dark:text-zinc-300"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--club-line)] bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}
