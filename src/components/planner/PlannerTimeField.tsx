"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Champ horaire du même esprit que le calendrier : un bouton « input » qui
 * ouvre un popover avec deux colonnes (heures / minutes) à choisir.
 */
export function PlannerTimeField({
  id,
  label,
  hint,
  value,
  onChange,
  minuteStep = 5,
}: {
  id: string;
  label: string;
  hint?: string;
  /** Valeur "HH:MM". */
  value: string;
  onChange: (value: string) => void;
  minuteStep?: number;
}) {
  const t = useTranslations("planner.wizard");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hourColRef = useRef<HTMLDivElement | null>(null);
  const minuteColRef = useRef<HTMLDivElement | null>(null);

  const [hh, mm] = value && value.includes(":") ? value.split(":") : ["", ""];

  // Liste des minutes par pas, en s'assurant que la minute courante y figure.
  const minutes = useMemo(() => {
    const base = new Set<number>();
    for (let m = 0; m < 60; m += minuteStep) base.add(m);
    const cur = Number(mm);
    if (mm !== "" && !Number.isNaN(cur)) base.add(cur);
    return Array.from(base)
      .sort((a, b) => a - b)
      .map(pad);
  }, [mm, minuteStep]);

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

  // Amène l'heure/minute sélectionnée dans le champ visible à l'ouverture.
  useEffect(() => {
    if (!open) return;
    hourColRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: "center" });
    minuteColRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: "center" });
  }, [open]);

  const setHour = (h: string) => onChange(`${h}:${mm || "00"}`);
  const setMinute = (m: string) => onChange(`${hh || "00"}:${m}`);

  const colBtn = (active: boolean) =>
    [
      "w-full rounded-[7px] px-2 py-1.5 text-center text-[13px] font-medium tabular-nums transition",
      active ? "bg-red-500 text-white" : "text-zinc-700 hover:bg-zinc-100",
    ].join(" ");

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
          <span className={value ? "tabular-nums" : "text-zinc-400"}>{value || "—"}</span>
          <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
        </button>
        {open ? (
          <div className="absolute left-0 z-30 mt-2 w-[200px] rounded-[12px] border border-zinc-200 bg-white shadow-[0_12px_32px_rgb(0_0_0/0.12)]">
            <div className="grid grid-cols-2">
              <div className="border-r border-zinc-200">
                <div className="border-b border-zinc-200 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                  {t("timeHours")}
                </div>
                <div
                  ref={hourColRef}
                  className="max-h-[200px] overflow-y-auto px-1.5 py-1.5"
                >
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      data-selected={h === hh}
                      onClick={() => setHour(h)}
                      className={colBtn(h === hh)}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="border-b border-zinc-200 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                  {t("timeMinutes")}
                </div>
                <div
                  ref={minuteColRef}
                  className="max-h-[200px] overflow-y-auto px-1.5 py-1.5"
                >
                  {minutes.map((m) => (
                    <button
                      key={m}
                      type="button"
                      data-selected={m === mm}
                      onClick={() => setMinute(m)}
                      className={colBtn(m === mm)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </div>
  );
}
