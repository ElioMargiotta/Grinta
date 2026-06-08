"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, CalendarRange } from "lucide-react";
import { switchSeasonAction } from "@/app/[locale]/(app)/club-actions";
import { useLoading } from "@/components/ui/LoadingProvider";

/**
 * Sélecteur de saison global (Topbar). Pilote la « saison active » du club,
 * mémorisée par cookie côté serveur, qui scope équipes / contingent / planif.
 */
export function SeasonSwitcher({
  current,
  seasons,
}: {
  current: string;
  seasons: string[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { run } = useLoading();
  const t = useTranslations("season");
  const tCommon = useTranslations("common");

  const options = seasons.includes(current) ? seasons : [current, ...seasons];

  const handleSelect = (season: string) => {
    if (season === current) {
      setOpen(false);
      return;
    }
    const fd = new FormData();
    fd.set("season", season);
    startTransition(async () => {
      await run(() => switchSeasonAction(fd), {
        label: tCommon("loading"),
        message: tCommon("pleaseWait"),
      });
      setOpen(false);
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        title={t("label")}
        className="flex items-center gap-2 rounded-md border border-[var(--club-line)] bg-white px-3 py-1.5 text-sm text-zinc-900 hover:bg-[var(--club-primary-soft)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        <CalendarRange className="h-4 w-4 shrink-0 text-[var(--club-primary)]" />
        <span className="font-medium tabular-nums">{current}</span>
        {options.length > 1 ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : null}
      </button>

      {open && options.length > 1 && (
        <div
          className="absolute left-0 z-40 mt-1 w-48 overflow-hidden rounded-md border border-[var(--club-line)] bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {t("label")}
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {options.map((s) => {
              const active = s === current;
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => handleSelect(s)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--club-primary-soft)] dark:hover:bg-zinc-800"
                  >
                    <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                      {s}
                    </span>
                    {active && <Check className="h-4 w-4 text-[var(--club-primary)]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
