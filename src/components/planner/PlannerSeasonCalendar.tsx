"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import type { SeasonMatch } from "./PlannerSeasonView";

type CalendarMatch = SeasonMatch & {
  ends_at: string | null;
  match_url: string | null;
};

const DAY_MS = 86_400_000;

/** ymd Europe/Zurich d'un ISO (cohérent avec le reste du wizard). */
function localYmd(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function ymdOf(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Lundi (UTC) de la semaine contenant la date donnée. */
function mondayOf(date: Date): Date {
  const js = date.getUTCDay();
  const iso = js === 0 ? 7 : js;
  return new Date(date.getTime() - (iso - 1) * DAY_MS);
}

function parseYmd(ymd: string): Date | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export function PlannerSeasonCalendar({
  matches,
  frameStart,
  frameEnd,
  value,
  onPick,
}: {
  matches: CalendarMatch[];
  frameStart: string;
  frameEnd: string;
  /** Jour sélectionné (ymd). */
  value: string;
  /** Fixe la date au jour cliqué (ymd). */
  onPick: (ymd: string) => void;
}) {
  const t = useTranslations("planner.wizard");
  const locale = useLocale();
  const todayYmd = ymdOf(new Date(`${ymdOf(new Date())}T00:00:00Z`));

  // Mois affiché par défaut : celui de la valeur (sinon début de cadre).
  const initialMonth = useMemo(() => {
    const base = parseYmd(value) ?? parseYmd(frameStart) ?? new Date();
    return { year: base.getUTCFullYear(), month: base.getUTCMonth() };
  }, [value, frameStart]);
  const [cursor, setCursor] = useState(initialMonth);

  // Index des matchs par jour (ymd) — anchor prioritaire pour la pastille.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarMatch[]>();
    for (const m of matches) {
      const ymd = localYmd(m.starts_at);
      if (!ymd) continue;
      const list = map.get(ymd);
      if (list) list.push(m);
      else map.set(ymd, [m]);
    }
    return map;
  }, [matches]);

  const monthStart = new Date(Date.UTC(cursor.year, cursor.month, 1));
  const gridStart = mondayOf(monthStart);
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * DAY_MS));

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    // 2024-01-01 est un lundi.
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(Date.UTC(2024, 0, 1 + i))),
    );
  }, [locale]);

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthStart);

  const monthMatches = days
    .filter((d) => d.getUTCMonth() === cursor.month)
    .flatMap((d) => byDay.get(ymdOf(d)) ?? [])
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const shiftMonth = (delta: number) =>
    setCursor(({ year, month }) => {
      const next = new Date(Date.UTC(year, month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });

  return (
    <div className="rounded-[12px] border border-zinc-200 bg-white">
      {/* En-tête : mois + navigation */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div className="text-[13px] font-semibold capitalize text-zinc-950">{monthLabel}</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label={t("calPrev")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(initialMonth)}
            className="h-7 rounded-[7px] border border-zinc-200 px-2.5 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950"
          >
            {t("calToday")}
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label={t("calNext")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Aide + légende */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 text-[11px]">
        <span className="text-zinc-500">{t("calPickHint")}</span>
        <div className="flex items-center gap-3 text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[4px] bg-red-100 ring-1 ring-inset ring-red-200" />
            {t("calAnchor")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[4px] bg-zinc-100 ring-1 ring-inset ring-zinc-200" />
            {t("calMatch")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[4px] bg-red-500" />
            {t("calSelected")}
          </span>
        </div>
      </div>

      {/* Grille */}
      <div className="px-3 pb-3 pt-2">
        <div className="grid grid-cols-7 gap-0.5">
          {weekdayLabels.map((w) => (
            <div
              key={w}
              className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400"
            >
              {w}
            </div>
          ))}
          {days.map((day) => {
            const ymd = ymdOf(day);
            const inMonth = day.getUTCMonth() === cursor.month;
            const inFrame = Boolean(frameStart && frameEnd && ymd >= frameStart && ymd <= frameEnd);
            const isReprise = ymd === value;
            const isToday = ymd === todayYmd;
            const dayMatches = byDay.get(ymd) ?? [];
            const hasAnchor = dayMatches.some((m) => m.is_anchor);
            const hasMatch = dayMatches.length > 0;
            const label = dayMatches[0]?.opponent ?? dayMatches[0]?.summary ?? null;

            return (
              <button
                key={ymd}
                type="button"
                onClick={() => onPick(ymd)}
                title={dayMatches.map((m) => m.opponent ?? m.summary ?? "—").join(" · ") || undefined}
                className={[
                  "relative flex min-h-[44px] min-w-0 flex-col items-center gap-0.5 overflow-hidden rounded-[7px] px-0.5 py-1 transition",
                  inMonth ? "" : "opacity-30",
                  isReprise
                    ? "bg-red-500 ring-2 ring-red-500"
                    : inFrame
                      ? "bg-zinc-50 hover:bg-zinc-100"
                      : "hover:bg-zinc-100",
                  isToday && !isReprise ? "ring-1 ring-inset ring-zinc-300" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-[12px] font-medium leading-none",
                    isReprise ? "text-white" : "text-zinc-700",
                  ].join(" ")}
                >
                  {day.getUTCDate()}
                </span>
                {hasMatch ? (
                  <span
                    className={[
                      "block w-full truncate rounded-[4px] px-1 text-center text-[9px] font-semibold leading-[13px]",
                      isReprise
                        ? "bg-white/25 text-white"
                        : hasAnchor
                          ? "bg-red-100 text-red-700"
                          : "bg-zinc-100 text-zinc-600",
                    ].join(" ")}
                  >
                    {label ?? t("calMatch")}
                    {dayMatches.length > 1 ? ` +${dayMatches.length - 1}` : ""}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Matchs du mois affiché */}
      <div className="border-t border-zinc-200 px-4 py-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
          {t("calMonthMatches", { n: monthMatches.length })}
        </div>
        {monthMatches.length === 0 ? (
          <p className="text-[12px] text-zinc-400">{t("calNoMatchMonth")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {monthMatches.map((m) => {
              const ymd = localYmd(m.starts_at);
              const dateStr = new Date(m.starts_at).toLocaleDateString(locale, {
                weekday: "short",
                day: "2-digit",
                month: "short",
              });
              const timeStr = new Date(m.starts_at).toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onPick(ymd)}
                    className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition hover:bg-zinc-50"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        m.is_anchor ? "bg-red-500" : "border border-zinc-300"
                      }`}
                    />
                    <span className="w-24 shrink-0 text-[11px] font-medium text-zinc-500">
                      {dateStr} · {timeStr}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-900">
                      {m.opponent ?? m.summary ?? "—"}
                    </span>
                    {m.location ? (
                      <span className="hidden items-center gap-1 truncate text-[11px] text-zinc-400 sm:flex">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {m.location}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Champ date du wizard : un bouton type « input » qui ouvre le calendrier des
 * matchs en popover, pour choisir une date en voyant les matchs importés.
 */
export function PlannerDateField({
  id,
  label,
  hint,
  value,
  matches,
  frameStart,
  frameEnd,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  matches: CalendarMatch[];
  frameStart: string;
  frameEnd: string;
  onChange: (ymd: string) => void;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const formatted = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
        weekday: "short",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="flex flex-col gap-1.5" ref={rootRef}>
      <label htmlFor={id} className="text-sm font-medium text-zinc-900">
        {label}
      </label>
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-sm text-zinc-900 shadow-sm transition hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 ${
            open ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-200"
          }`}
        >
          <span className={value ? "" : "text-zinc-400"}>{formatted}</span>
          <CalendarDays className="h-4 w-4 shrink-0 text-zinc-400" />
        </button>
        {open ? (
          <div className="absolute left-0 z-30 mt-2 w-[min(92vw,420px)] rounded-[12px] shadow-[0_12px_32px_rgb(0_0_0/0.12)]">
            <PlannerSeasonCalendar
              matches={matches}
              frameStart={frameStart}
              frameEnd={frameEnd}
              value={value}
              onPick={(ymd) => {
                onChange(ymd);
                setOpen(false);
              }}
            />
          </div>
        ) : null}
      </div>
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </div>
  );
}
