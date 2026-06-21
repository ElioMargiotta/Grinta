"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import { formatDay } from "@/lib/contingent/week";

export type Point = { date: string; value: number };
export type Trend = "up" | "down" | "flat";

export function parseValue(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function fmt(value: number | null): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function trendOf(
  first: number,
  last: number,
  higherIsBetter: boolean,
): { trend: Trend; color: string } {
  const delta = last - first;
  if (delta === 0) return { trend: "flat", color: "#a1a1aa" };
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return { trend: improved ? "up" : "down", color: improved ? "#16a34a" : "#dc2626" };
}

export function TrendArrow({ trend, className }: { trend: Trend; className?: string }) {
  if (trend === "flat") return <ArrowRight className={className ?? "h-3.5 w-3.5 text-zinc-400"} />;
  if (trend === "up") return <ArrowUpRight className={className ?? "h-3.5 w-3.5 text-green-600"} />;
  return <ArrowDownRight className={className ?? "h-3.5 w-3.5 text-red-600"} />;
}

/** Petite courbe SVG maison (pas de lib de charting dans le repo). */
export function Sparkline({ points, higherIsBetter }: { points: Point[]; higherIsBetter: boolean }) {
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

/** Courbe plein format avec axes pour la modale d'un test (série unique). */
export function MetricChart({
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

export type Series = {
  id: string;
  label: string;
  color: string;
  points: Point[];
};

/** Palette stable pour distinguer les joueurs sur le graphe comparatif. */
export const SERIES_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#9333ea",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
];

/**
 * Courbe multi-séries (une ligne par joueur) avec axes datés. Les dates de
 * l'axe X sont l'union triée de toutes les dates présentes dans les séries ;
 * chaque point est positionné selon l'index de sa date dans cet axe.
 */
export function MultiSeriesChart({
  series,
  unit,
}: {
  series: Series[];
  unit: string | null;
}) {
  const allDates = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => p.date))),
  ).sort();

  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  if (allDates.length === 0 || allValues.length === 0) {
    return null;
  }

  const W = 640;
  const H = 280;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const pad = (rawMax - rawMin) * 0.12 || Math.abs(rawMax) * 0.12 || 1;
  const min = rawMin - pad;
  const max = rawMax + pad;
  const span = max - min || 1;

  const dateIndex = new Map(allDates.map((d, i) => [d, i]));
  const x = (date: string) =>
    padL +
    (allDates.length === 1
      ? plotW / 2
      : (plotW * (dateIndex.get(date) ?? 0)) / (allDates.length - 1));
  const y = (v: number) => padT + plotH * (1 - (v - min) / span);

  const yTicks = Array.from({ length: 4 }, (_, i) => min + (span * i) / 3);
  const xStep = Math.ceil(allDates.length / 8);

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
      {allDates.map((d, i) =>
        i % xStep === 0 || i === allDates.length - 1 ? (
          <text key={d} x={x(d)} y={H - padB + 16} textAnchor="middle" className="fill-zinc-400 text-[10px]">
            {formatDay(d)}
          </text>
        ) : null,
      )}
      {series.map((s) => {
        const sorted = [...s.points].sort((a, b) => a.date.localeCompare(b.date));
        const line = sorted
          .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`)
          .join(" ");
        return (
          <g key={s.id}>
            <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {sorted.map((p) => (
              <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={2.5} fill={s.color} />
            ))}
          </g>
        );
      })}
      {unit ? (
        <text x={padL - 6} y={padT - 4} textAnchor="end" className="fill-zinc-400 text-[10px]">
          {unit}
        </text>
      ) : null}
    </svg>
  );
}
