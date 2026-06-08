"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { setPeriodizationSettingsAction } from "@/app/[locale]/(app)/teams/[teamId]/calendar/match-actions";

type Periodization = {
  training_weekdays: number[];
  md_scheme: string;
};

// ISO : 1 = lundi … 7 = dimanche.
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const SCHEMES = ["standard", "congested", "custom"] as const;

export function PeriodizationSettingsForm({
  teamId,
  season,
  periodization,
}: {
  teamId: string;
  season: string;
  periodization: Periodization | null;
}) {
  const t = useTranslations("teams.calendar.settings");
  const [days, setDays] = useState<number[]>(
    periodization?.training_weekdays ?? [2, 4],
  );
  const [scheme, setScheme] = useState<string>(
    periodization?.md_scheme ?? "standard",
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleDay = (d: number) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );

  const onSave = () => {
    if (days.length === 0) {
      setMsg({ ok: false, text: t("noDays") });
      return;
    }
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("season", season);
    fd.set("md_scheme", scheme);
    for (const d of days) fd.append("training_weekdays", String(d));
    startTransition(async () => {
      setMsg(null);
      const r = await setPeriodizationSettingsAction(fd);
      setMsg(r?.ok ? { ok: true, text: t("saved") } : { ok: false, text: t("error") });
    });
  };

  return (
    <div className="mt-6 rounded-lg border border-[var(--club-line)] bg-white/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <SlidersHorizontal className="h-4 w-4 text-[var(--club-primary)]" />
        {t("title")}
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {t("trainingDays")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const active = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  aria-pressed={active}
                  className={`h-9 w-11 rounded-md border text-xs font-medium transition ${
                    active
                      ? "border-[var(--club-primary)] bg-[var(--club-primary)] text-[var(--club-primary-foreground)]"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {t(`day.${d}`)}
                </button>
              );
            })}
          </div>
        </div>

        <Select
          id="md-scheme"
          label={t("scheme")}
          value={scheme}
          onChange={(e) => setScheme(e.target.value)}
          className="md:w-56"
        >
          {SCHEMES.map((s) => (
            <option key={s} value={s}>
              {t(`schemeOption.${s}`)}
            </option>
          ))}
        </Select>

        <Button
          type="button"
          size="sm"
          onClick={onSave}
          loading={isPending}
          loadingLabel={t("saving")}
        >
          {t("save")}
        </Button>
      </div>

      {msg ? (
        <p
          className={`mt-3 text-sm ${
            msg.ok
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
