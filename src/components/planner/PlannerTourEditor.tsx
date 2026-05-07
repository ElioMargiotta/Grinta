"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateMacrocycleAction } from "@/app/[locale]/(app)/planner/[teamId]/periodization/actions";
import type { Macrocycle } from "./PlannerTourView";

type MesoDraft = {
  id: string;
  name: string;
  kind: "preparation" | "competition" | "transition" | "custom";
  color: string;
};

export function PlannerTourEditor({
  teamId,
  macrocycle,
  onClose,
}: {
  teamId: string;
  macrocycle: Macrocycle;
  onClose: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("planner.setup");
  const tEdit = useTranslations("planner.edit");

  const [name, setName] = useState(macrocycle.name);
  const [preseasonStart, setPreseasonStart] = useState(macrocycle.preseason_start_date);
  const [firstMatch, setFirstMatch] = useState(macrocycle.first_match_date);
  const [endDate, setEndDate] = useState(macrocycle.end_date);
  const [mesos, setMesos] = useState<MesoDraft[]>(
    macrocycle.mesocycles.map((m) => ({
      id: m.id,
      name: m.name,
      kind: m.kind,
      color: m.color ?? "#64748b",
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateMeso = (id: string, patch: Partial<MesoDraft>) =>
    setMesos((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

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

    const fd = new FormData();
    fd.set("id", macrocycle.id);
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
          id: m.id,
          name: m.name,
          kind: m.kind,
          color: m.color,
        })),
      ),
    );

    startTransition(async () => {
      const r = await updateMacrocycleAction(fd);
      if (r?.error) setError(r.error);
      else onClose();
    });
  };

  return (
    <div className="border-b border-zinc-200 bg-zinc-50/40 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/30">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input
          id={`edit-name-${macrocycle.id}`}
          label={t("name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div />
        <Input
          id={`edit-preseason-${macrocycle.id}`}
          type="date"
          label={t("preseasonStart")}
          value={preseasonStart}
          onChange={(e) => setPreseasonStart(e.target.value)}
        />
        <Input
          id={`edit-firstmatch-${macrocycle.id}`}
          type="date"
          label={t("firstMatch")}
          value={firstMatch}
          onChange={(e) => setFirstMatch(e.target.value)}
        />
        <Input
          id={`edit-end-${macrocycle.id}`}
          type="date"
          label={t("endDate")}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          hint={tEdit("endDateHint")}
        />
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {t("mesocycles")}
        </h4>
        <div className="mt-2 flex flex-col gap-2">
          {mesos.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <input
                type="color"
                value={m.color}
                onChange={(e) => updateMeso(m.id, { color: e.target.value })}
                className="h-9 w-9 cursor-pointer rounded-md border border-zinc-200 dark:border-zinc-700"
                aria-label="color"
              />
              <Input
                id={`edit-meso-name-${m.id}`}
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
                    updateMeso(m.id, { kind: e.target.value as MesoDraft["kind"] })
                  }
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="preparation">{t("kind.preparation")}</option>
                  <option value="competition">{t("kind.competition")}</option>
                  <option value="transition">{t("kind.transition")}</option>
                  <option value="custom">{t("kind.custom")}</option>
                </select>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          {tEdit("mesoCountHint")}
        </p>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          {tEdit("cancel")}
        </Button>
        <Button type="button" size="sm" onClick={submit} disabled={isPending}>
          {isPending ? tEdit("saving") : tEdit("save")}
        </Button>
      </div>
    </div>
  );
}
