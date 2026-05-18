"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createMacrocycleAction } from "@/app/[locale]/(app)/planner/[teamId]/periodization/actions";

type MesocycleDraft = {
  id: string;
  name: string;
  kind: "preparation" | "competition" | "transition" | "custom";
  weekCount: number;
  color: string;
};



function mondayOfISO(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt;
}

function diffWeeksUTC(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 86_400_000));
}

export function PlannerSetupWizard({
  teamId,
  defaultName,
}: {
  teamId: string;
  defaultName: string;
}) {
  const locale = useLocale();
  const t = useTranslations("planner.setup");
  const tPlannerTour = useTranslations("planner.tour");

  const [name, setName] = useState(defaultName);
  const [preseasonStart, setPreseasonStart] = useState("");
  const [firstMatch, setFirstMatch] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mesos, setMesos] = useState<MesocycleDraft[]>(() => [
    { id: "m1", name: t("kind.preparation"), kind: "preparation", weekCount: 3, color: "#0ea5e9" },
    { id: "m2", name: t("kind.competition"), kind: "competition", weekCount: 12, color: "#dc2626" },
    { id: "m3", name: t("kind.transition"), kind: "transition", weekCount: 3, color: "#f59e0b" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalWeeks = useMemo(() => {
    const a = mondayOfISO(preseasonStart);
    const b = mondayOfISO(endDate);
    if (!a || !b) return null;
    const w = diffWeeksUTC(a, b) + 1;
    return w > 0 ? w : null;
  }, [preseasonStart, endDate]);

  const sumWeeks = useMemo(
    () => mesos.reduce((s, m) => s + (m.weekCount || 0), 0),
    [mesos],
  );

  const weekDelta = totalWeeks !== null ? sumWeeks - totalWeeks : 0;

  const updateMeso = (id: string, patch: Partial<MesocycleDraft>) =>
    setMesos((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const addMeso = () =>
    setMesos((prev) => [
      ...prev,
      {
        id: `m${Date.now()}`,
        name: t("customMesoName"),
        kind: "custom",
        weekCount: 1,
        color: "#64748b",
      },
    ]);

  const removeMeso = (id: string) =>
    setMesos((prev) => prev.filter((m) => m.id !== id));

  const submit = () => {
    setError(null);
    if (!name.trim()) {
      setError(t("err.nameRequired"));
      return;
    }
    if (!preseasonStart || !firstMatch || !endDate) {
      setError(t("err.datesRequired"));
      return;
    }
    if (totalWeeks === null) {
      setError(t("err.invalidDates"));
      return;
    }
    if (weekDelta !== 0) {
      setError(t("err.weekMismatch", { sum: sumWeeks, total: totalWeeks }));
      return;
    }

    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("locale", locale);
    fd.set("name", name);
    fd.set("preseasonStart", preseasonStart);
    fd.set("firstMatch", firstMatch);
    fd.set("endDate", endDate);
    fd.set(
      "mesocycles",
      JSON.stringify(
        mesos.map((m) => ({
          name: m.name,
          kind: m.kind,
          weekCount: m.weekCount,
          color: m.color,
        })),
      ),
    );

    startTransition(async () => {
      const r = await createMacrocycleAction(fd);
      if (r?.error) setError(r.error);
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          id="macroName"
          label={t("name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("tourNamePlaceholder")}
        />
        <div /> {/* spacer */}
        <Input
          id="preseasonStart"
          type="date"
          label={t("preseasonStart")}
          value={preseasonStart}
          onChange={(e) => setPreseasonStart(e.target.value)}
          hint={t("preseasonStartHint")}
        />
        <Input
          id="firstMatch"
          type="date"
          label={t("firstMatch")}
          value={firstMatch}
          onChange={(e) => setFirstMatch(e.target.value)}
          hint={t("firstMatchHint")}
        />
        <Input
          id="endDate"
          type="date"
          label={t("endDate")}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          hint={t("endDateHint")}
        />
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t("mesocycles")}
          </h3>
          <span
            className={`text-xs font-medium tabular-nums ${
              totalWeeks === null
                ? "text-zinc-400"
                : weekDelta === 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {totalWeeks === null
              ? t("totalWeeksPending")
              : t("totalWeeksCount", { sum: sumWeeks, total: totalWeeks })}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {mesos.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40"
            >
              <input
                type="color"
                value={m.color}
                onChange={(e) => updateMeso(m.id, { color: e.target.value })}
                className="h-10 w-10 cursor-pointer rounded-md border border-zinc-200 bg-transparent dark:border-zinc-700"
                aria-label={tPlannerTour("colorAriaLabel")}
              />
              <Input
                id={`meso-name-${m.id}`}
                label={t("mesoName")}
                value={m.name}
                onChange={(e) => updateMeso(m.id, { name: e.target.value })}
                className="min-w-[180px]"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("mesoKind")}
                </label>
                <select
                  value={m.kind}
                  onChange={(e) =>
                    updateMeso(m.id, { kind: e.target.value as MesocycleDraft["kind"] })
                  }
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="preparation">{t("kind.preparation")}</option>
                  <option value="competition">{t("kind.competition")}</option>
                  <option value="transition">{t("kind.transition")}</option>
                  <option value="custom">{t("kind.custom")}</option>
                </select>
              </div>
              <Input
                id={`meso-weeks-${m.id}`}
                type="number"
                min={1}
                label={t("mesoWeeks")}
                value={m.weekCount}
                onChange={(e) =>
                  updateMeso(m.id, { weekCount: Math.max(1, Number(e.target.value) || 1) })
                }
                className="w-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeMeso(m.id)}
                className="ml-auto"
                disabled={mesos.length <= 1}
              >
                {t("remove")}
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addMeso}
          className="mt-3"
        >
          + {t("addMesocycle")}
        </Button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <Button onClick={submit} disabled={isPending}>
          {isPending ? t("creating") : t("create")}
        </Button>
      </div>
    </div>
  );
}
