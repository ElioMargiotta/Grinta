"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { updateMicrocycleAction } from "@/app/[locale]/(app)/planner/[teamId]/periodization/actions";

export const THEME_OPTIONS = [
  "possede_ballon",
  "ne_possede_pas",
  "recupere",
  "perd",
  "recupere_perd",
  "decharge",
  "jeux_polysport",
] as const;

export type ThemeKey = (typeof THEME_OPTIONS)[number];

export const THEME_COLORS: Record<ThemeKey, { bg: string; border: string; dot: string }> = {
  possede_ballon: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-l-emerald-500",
    dot: "#10b981",
  },
  ne_possede_pas: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-l-rose-500",
    dot: "#f43f5e",
  },
  recupere: {
    bg: "bg-sky-50 dark:bg-sky-950/40",
    border: "border-l-sky-500",
    dot: "#0ea5e9",
  },
  perd: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-l-amber-500",
    dot: "#f59e0b",
  },
  recupere_perd: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-l-violet-500",
    dot: "#8b5cf6",
  },
  decharge: {
    bg: "bg-zinc-100 dark:bg-zinc-800/60",
    border: "border-l-zinc-400",
    dot: "#94a3b8",
  },
  jeux_polysport: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-l-teal-500",
    dot: "#14b8a6",
  },
};

const FORMAT_OPTIONS = ["1v1_2v2", "3v3_5v5"] as const;

export function MicrocycleThemePicker({
  microcycleId,
  teamId,
  currentTheme,
  currentFormat,
  currentNotes,
  onClose,
  placement = "popover",
}: {
  microcycleId: string;
  teamId: string;
  currentTheme: string | null;
  currentFormat: string | null;
  currentNotes: string | null;
  onClose: () => void;
  placement?: "popover" | "inline";
}) {
  const locale = useLocale();
  const t = useTranslations("planner.theme");
  const [theme, setTheme] = useState<string>(currentTheme ?? "");
  const [format, setFormat] = useState<string>(currentFormat ?? "");
  const [notes, setNotes] = useState<string>(currentNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  const submit = (overrideTheme?: string) => {
    setError(null);
    const fd = new FormData();
    fd.set("id", microcycleId);
    fd.set("teamId", teamId);
    fd.set("locale", locale);
    fd.set("theme", overrideTheme ?? theme);
    fd.set("format", format);
    fd.set("notes", notes);
    startTransition(async () => {
      const r = await updateMicrocycleAction(fd);
      if (r?.error) setError(r.error);
      else onClose();
    });
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      className={
        placement === "inline"
          ? "z-10 mt-2 w-full rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          : "absolute left-1/2 top-full z-30 mt-1 w-72 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      }
    >
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {t("quickFill")}
      </div>
      <div className="grid grid-cols-1 gap-1">
        {THEME_OPTIONS.map((key) => {
          const isActive = theme === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTheme(key);
                submit(key);
              }}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                isActive
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: THEME_COLORS[key].dot }}
              />
              <span className="flex-1 text-zinc-800 dark:text-zinc-100">
                {t(`option.${key}`)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t("format")}
        </div>
        <div className="flex flex-wrap gap-1">
          {FORMAT_OPTIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(format === f ? "" : f)}
              className={`rounded-full border px-2 py-1 text-[11px] font-medium transition-colors ${
                format === f
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {t(`formatOption.${f}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t("notes")}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={t("notesPlaceholder")}
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-3 flex justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setTheme("");
            submit("");
          }}
          disabled={isPending}
        >
          {t("clear")}
        </Button>
        <Button type="button" size="sm" onClick={() => submit()} disabled={isPending}>
          {isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
