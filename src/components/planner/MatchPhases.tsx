"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Save, Shapes } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PhaseBoard } from "@/components/planner/PhaseBoard";
import type { PhaseBoardValue, PhaseKind } from "@/lib/planner/tacticalSystems";
import { setMatchPhasesAction } from "@/app/[locale]/(app)/teams/[teamId]/calendar/match-actions";

export type MatchPhase = {
  id: string;
  systemName: string;
  kind: PhaseKind;
  name: string | null;
  board: PhaseBoardValue;
};

/**
 * Sélection des phases arrêtées à utiliser pour ce match, parmi les phases des
 * systèmes de l'équipe. Les phases retenues s'affichent en aperçu (lecture seule).
 */
export function MatchPhases({
  teamId,
  matchId,
  phases,
  initialSelected,
}: {
  teamId: string;
  matchId: string;
  phases: MatchPhase[];
  initialSelected: string[];
}) {
  const t = useTranslations("planner.systems");
  const tMatch = useTranslations("planner.match.prematch");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected.filter((id) => phases.some((p) => p.id === id))),
  );
  const [isSaving, startSave] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  if (phases.length === 0) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    setSavedMsg(null);
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("matchId", matchId);
    fd.set("phaseIds", JSON.stringify([...selected]));
    startSave(async () => {
      const r = await setMatchPhasesAction(fd);
      if (!r?.error) {
        setSavedMsg(t("phasesSaved"));
        router.refresh();
      }
    });
  }

  const chosen = phases.filter((p) => selected.has(p.id));

  return (
    <section className="flex flex-col gap-3 border-t border-[var(--club-line)] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          <Shapes className="h-4 w-4 text-[var(--club-primary)]" />
          {t("matchPhasesTitle")}
        </div>
        <Button type="button" size="sm" onClick={save} loading={isSaving}>
          <Save className="h-3.5 w-3.5" />
          {tMatch("save")}
        </Button>
      </div>

      <ul className="flex flex-col divide-y divide-[var(--club-line)] overflow-hidden rounded-lg border border-[var(--club-line)]">
        {phases.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 px-3 py-2">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
                className="h-4 w-4 accent-[var(--club-primary)]"
              />
              <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                {p.name || t(`phaseKind.${p.kind}`)}
              </span>
              <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {t(`phaseKind.${p.kind}`)}
              </span>
            </label>
            <span className="shrink-0 text-xs text-zinc-400">{p.systemName}</span>
          </li>
        ))}
      </ul>

      {savedMsg ? (
        <span className="text-sm text-emerald-700 dark:text-emerald-400">
          {savedMsg}
        </span>
      ) : null}

      {chosen.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {chosen.map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {p.name || t(`phaseKind.${p.kind}`)}
              </div>
              <PhaseBoard value={p.board} readOnly />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
