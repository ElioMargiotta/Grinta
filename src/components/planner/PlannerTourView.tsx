"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  MicrocycleThemePicker,
  THEME_COLORS,
  type ThemeKey,
} from "./MicrocycleThemePicker";
import { PlannerTourEditor } from "./PlannerTourEditor";
import { PlannerSetupWizard } from "./PlannerSetupWizard";
import {
  addMesocycleAction,
  deleteMacrocycleAction,
  removeMesocycleAction,
} from "@/app/[locale]/(app)/planner/[teamId]/periodization/actions";

export type Microcycle = {
  id: string;
  start_date: string;
  week_number: number;
  theme: string | null;
  format: string | null;
  notes: string | null;
  session_count: number;
};

export type Mesocycle = {
  id: string;
  name: string;
  kind: "preparation" | "competition" | "transition" | "custom";
  color: string | null;
  microcycles: Microcycle[];
};

export type Macrocycle = {
  id: string;
  name: string;
  preseason_start_date: string;
  first_match_date: string;
  end_date: string;
  mesocycles: Mesocycle[];
};

const KNOWN_THEMES: ThemeKey[] = [
  "possede_ballon",
  "ne_possede_pas",
  "recupere",
  "perd",
  "recupere_perd",
  "decharge",
  "jeux_polysport",
];

function isKnownTheme(t: string | null): t is ThemeKey {
  return !!t && (KNOWN_THEMES as string[]).includes(t);
}

export function formatWeekLabel(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function formatDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function PlannerTourView({
  teamId,
  macrocycles,
  teamName,
  season,
}: {
  teamId: string;
  macrocycles: Macrocycle[];
  teamName: string;
  season: string | null;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("planner.tour");
  const tTheme = useTranslations("planner.theme");
  const [openMicroId, setOpenMicroId] = useState<string | null>(null);
  const [editingMacroId, setEditingMacroId] = useState<string | null>(null);
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(
    () => macrocycles[0]?.id ?? null,
  );
  const [creatingTour, setCreatingTour] = useState(false);

  const macro =
    macrocycles.find((m) => m.id === selectedMacroId) ??
    macrocycles[0] ??
    null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
            {t("season")}
          </div>
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {season ?? t("seasonUnset")}
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950/50">
          {macrocycles.map((m) => {
            const isActive = m.id === selectedMacroId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMacroId(m.id);
                  setCreatingTour(false);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {m.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setCreatingTour(true);
              setSelectedMacroId(null);
            }}
            className={`flex items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-xs font-semibold transition-colors ${
              creatingTour
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
            }`}
          >
            <span className="text-sm leading-none">+</span>
            {t("newTour")}
          </button>
        </div>
      </div>

      {creatingTour ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <PlannerSetupWizard teamId={teamId} defaultName={teamName} />
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCreatingTour(false)}
            >
              {t("close")}
            </Button>
          </div>
        </div>
      ) : null}

      {macro ? (
        <TourPanel
          key={macro.id}
          macro={macro}
          teamId={teamId}
          locale={locale}
          editing={editingMacroId === macro.id}
          onToggleEdit={() =>
            setEditingMacroId(editingMacroId === macro.id ? null : macro.id)
          }
          openMicroId={openMicroId}
          setOpenMicroId={setOpenMicroId}
          onDelete={async () => {
            if (!confirm(t("confirmDelete"))) return;
            const fd = new FormData();
            fd.set("id", macro.id);
            fd.set("teamId", teamId);
            fd.set("locale", locale);
            await deleteMacrocycleAction(fd);
            router.refresh();
          }}
          tTour={t}
          tTheme={tTheme}
          isKnownTheme={isKnownTheme}
        />
      ) : null}
    </div>
  );
}

type TourPanelProps = {
  macro: Macrocycle;
  teamId: string;
  locale: string;
  editing: boolean;
  onToggleEdit: () => void;
  openMicroId: string | null;
  setOpenMicroId: (id: string | null) => void;
  onDelete: () => void;
  tTour: ReturnType<typeof useTranslations>;
  tTheme: ReturnType<typeof useTranslations>;
  isKnownTheme: (t: string | null) => t is ThemeKey;
};

function TourPanel({
  macro,
  teamId,
  locale,
  editing,
  onToggleEdit,
  openMicroId,
  setOpenMicroId,
  onDelete,
  tTour,
  tTheme,
  isKnownTheme,
}: TourPanelProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {macro.name}
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {formatDate(macro.preseason_start_date, locale)} →{" "}
            {formatDate(macro.end_date, locale)} · {tTour("firstMatch")}{" "}
            {formatDate(macro.first_match_date, locale)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="secondary" size="sm" onClick={onToggleEdit}>
            {editing ? tTour("close") : tTour("edit")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            {tTour("delete")}
          </Button>
        </div>
      </div>

      {editing ? (
        <PlannerTourEditor
          teamId={teamId}
          macrocycle={macro}
          onClose={onToggleEdit}
        />
      ) : null}

      <div className="overflow-x-auto p-3">
        <div className="flex flex-col gap-2 min-w-fit">
          {macro.mesocycles.map((meso, mi) => {
            const isLast = mi === macro.mesocycles.length - 1;
            return (
              <MesoRow
                key={meso.id}
                meso={meso}
                isLast={isLast}
                canRemove={isLast && macro.mesocycles.length > 1}
                teamId={teamId}
                locale={locale}
                openMicroId={openMicroId}
                setOpenMicroId={setOpenMicroId}
                tTour={tTour}
                tTheme={tTheme}
                isKnownTheme={isKnownTheme}
              />
            );
          })}
          <AddCycleRow macroId={macro.id} teamId={teamId} tTour={tTour} />
        </div>
      </div>
    </div>
  );
}

function MesoRow({
  meso,
  canRemove,
  teamId,
  locale,
  openMicroId,
  setOpenMicroId,
  tTour,
  tTheme,
  isKnownTheme,
}: {
  meso: Mesocycle;
  isLast: boolean;
  canRemove: boolean;
  teamId: string;
  locale: string;
  openMicroId: string | null;
  setOpenMicroId: (id: string | null) => void;
  tTour: ReturnType<typeof useTranslations>;
  tTheme: ReturnType<typeof useTranslations>;
  isKnownTheme: (t: string | null) => t is ThemeKey;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRemove = () => {
    if (!confirm(tTour("confirmRemoveCycle"))) return;
    const fd = new FormData();
    fd.set("mesoId", meso.id);
    fd.set("teamId", teamId);
    fd.set("locale", locale);
    startTransition(async () => {
      const r = await removeMesocycleAction(fd);
      if (r?.error) alert(r.error);
      else router.refresh();
    });
  };

  return (
    <div className="flex items-stretch gap-2">
      <div
        className="flex w-44 shrink-0 flex-col justify-center rounded-lg border-l-4 bg-zinc-50/70 px-3 py-2 dark:bg-zinc-950/40"
        style={{ borderLeftColor: meso.color ?? "#94a3b8" }}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {tTour(`mesoKind.${meso.kind}`)}
          </span>
          {canRemove ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              title={tTour("removeCycle")}
              className="text-zinc-400 hover:text-red-600 disabled:opacity-40 dark:text-zinc-500 dark:hover:text-red-400"
              aria-label={tTour("removeCycle")}
            >
              ✕
            </button>
          ) : null}
        </div>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {meso.name}
        </span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {tTour("weeksCount", { n: meso.microcycles.length })}
        </span>
      </div>

      <div className="flex flex-1 flex-wrap gap-2">
        {meso.microcycles.map((micro) => {
          const themeKey = isKnownTheme(micro.theme) ? micro.theme : null;
          const colors = themeKey
            ? THEME_COLORS[themeKey]
            : {
                bg: "bg-white dark:bg-zinc-900",
                border: "border-l-zinc-200 dark:border-l-zinc-700",
                dot: "#cbd5e1",
              };
          const isOpen = openMicroId === micro.id;
          return (
            <div key={micro.id} className="relative">
              <button
                type="button"
                onClick={() => setOpenMicroId(isOpen ? null : micro.id)}
                className={`flex h-[88px] w-32 flex-col items-start justify-between rounded-lg border border-zinc-200 border-l-4 px-2.5 py-2 text-left transition-shadow hover:shadow-sm dark:border-zinc-700 ${colors.bg} ${colors.border}`}
              >
                <div className="flex w-full items-baseline justify-between gap-1">
                  <span className="text-[11px] font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatWeekLabel(micro.week_number)}
                  </span>
                  <span className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                    {formatDate(micro.start_date, locale)}
                  </span>
                </div>
                <div className="line-clamp-2 text-[10px] font-medium leading-tight text-zinc-700 dark:text-zinc-200">
                  {themeKey ? (
                    tTheme(`option.${themeKey}`)
                  ) : micro.theme ? (
                    micro.theme
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500">
                      + {tTour("setTheme")}
                    </span>
                  )}
                </div>
                <div className="flex w-full items-center justify-between gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span className="truncate">
                    {micro.format === "1v1_2v2" || micro.format === "3v3_5v5"
                      ? tTheme(`formatOption.${micro.format}`)
                      : (micro.format ?? "")}
                  </span>
                  {micro.session_count > 0 ? (
                    <span className="rounded bg-zinc-100 px-1 text-[9px] font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {micro.session_count}
                    </span>
                  ) : null}
                </div>
              </button>
              {isOpen ? (
                <MicrocycleThemePicker
                  microcycleId={micro.id}
                  teamId={teamId}
                  currentTheme={micro.theme}
                  currentFormat={micro.format}
                  currentNotes={micro.notes}
                  onClose={() => setOpenMicroId(null)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddCycleRow({
  macroId,
  teamId,
  tTour,
}: {
  macroId: string;
  teamId: string;
  tTour: ReturnType<typeof useTranslations>;
}) {
  const router = useRouter();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<
    "preparation" | "competition" | "transition" | "custom"
  >("custom");
  const [weekCount, setWeekCount] = useState(4);
  const [color, setColor] = useState("#64748b");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-44 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2.5 text-xs font-semibold text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
      >
        <span className="text-sm leading-none">+</span>
        {tTour("addCycle")}
      </button>
    );
  }

  const submit = () => {
    setError(null);
    if (weekCount <= 0 || weekCount > 26) {
      setError(tTour("weekCountInvalid"));
      return;
    }
    const fd = new FormData();
    fd.set("macroId", macroId);
    fd.set("teamId", teamId);
    fd.set("locale", locale);
    fd.set("name", name);
    fd.set("kind", kind);
    fd.set("color", color);
    fd.set("weekCount", String(weekCount));
    startTransition(async () => {
      const r = await addMesocycleAction(fd);
      if (r?.error) {
        setError(r.error);
      } else {
        setOpen(false);
        setName("");
        setWeekCount(4);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-zinc-50/40 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/30">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="h-9 w-9 cursor-pointer rounded-md border border-zinc-200 dark:border-zinc-700"
        aria-label="color"
      />
      <Input
        id={`add-cycle-name-${macroId}`}
        label={tTour("cycleName")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="min-w-[160px]"
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {tTour("cycleKind")}
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="h-10 rounded-lg border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="preparation">{tTour("mesoKind.preparation")}</option>
          <option value="competition">{tTour("mesoKind.competition")}</option>
          <option value="transition">{tTour("mesoKind.transition")}</option>
          <option value="custom">{tTour("mesoKind.custom")}</option>
        </select>
      </div>
      <Input
        id={`add-cycle-weeks-${macroId}`}
        type="number"
        label={tTour("cycleWeeks")}
        value={String(weekCount)}
        onChange={(e) => setWeekCount(Number(e.target.value))}
        className="w-24"
      />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={submit} disabled={isPending}>
          {isPending ? tTour("adding") : tTour("addCycleSubmit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          {tTour("close")}
        </Button>
      </div>
      {error ? (
        <p className="basis-full text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
