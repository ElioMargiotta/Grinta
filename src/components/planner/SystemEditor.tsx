"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeft, Plus, Printer, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LineupBoard, type LineupValue } from "@/components/planner/LineupBoard";
import { MatchTactics, type TacticsValue } from "@/components/planner/MatchTactics";
import { PhaseBoard } from "@/components/planner/PhaseBoard";
import { MatchPrintSheet } from "@/components/planner/MatchPrintSheet";
import type { RosterPlayer } from "@/components/planner/MatchParticipations";
import { FORMATIONS } from "@/components/planner/match/formations";
import {
  EMPTY_BOARD,
  PHASE_KINDS,
  type PhaseBoardValue,
  type PhaseKind,
} from "@/lib/planner/tacticalSystems";
import {
  deleteSystemAction,
  saveSystemAction,
} from "@/app/[locale]/(app)/systems/[teamId]/actions";

type PhaseDraft = {
  id: string;
  kind: PhaseKind;
  name: string;
  board: PhaseBoardValue;
};

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function SystemEditor({
  teamId,
  roster,
  systemId,
  initialName,
  initialLineup,
  initialTactics,
  initialPhases,
  clubLogoUrl,
}: {
  teamId: string;
  roster: RosterPlayer[];
  systemId: string | null;
  initialName: string;
  initialLineup: LineupValue;
  initialTactics: TacticsValue;
  initialPhases: PhaseDraft[];
  clubLogoUrl?: string | null;
}) {
  const t = useTranslations("planner.systems");
  const tMatch = useTranslations("planner.match.prematch");
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [lineup, setLineup] = useState<LineupValue>(initialLineup);
  const [tactics, setTactics] = useState<TacticsValue>(initialTactics);
  const [phases, setPhases] = useState<PhaseDraft[]>(initialPhases);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function addPhase() {
    setPhases((p) => [
      ...p,
      { id: uid(), kind: "attack_corner", name: "", board: { ...EMPTY_BOARD } },
    ]);
  }
  function patchPhase(id: string, patch: Partial<PhaseDraft>) {
    setPhases((p) => p.map((ph) => (ph.id === id ? { ...ph, ...patch } : ph)));
  }
  function removePhase(id: string) {
    setPhases((p) => p.filter((ph) => ph.id !== id));
  }

  function save() {
    setError(null);
    if (!name.trim()) {
      setError(t("err.nameRequired"));
      return;
    }
    const fd = new FormData();
    fd.set("teamId", teamId);
    if (systemId) fd.set("systemId", systemId);
    fd.set("name", name.trim());
    fd.set("formation", lineup.formation);
    fd.set("lineup", JSON.stringify(lineup));
    fd.set("tactics", JSON.stringify(tactics));
    fd.set(
      "phases",
      JSON.stringify(
        phases.map((p) => ({ kind: p.kind, name: p.name, board: p.board })),
      ),
    );
    startSave(async () => {
      const r = await saveSystemAction(fd);
      if (r?.error) setError(r.error);
      else router.push(`/systems/${teamId}`);
    });
  }

  function onDelete() {
    if (!systemId) return;
    if (!window.confirm(t("deleteConfirm"))) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("systemId", systemId);
    startDelete(async () => {
      const r = await deleteSystemAction(fd);
      if (r?.error) setError(r.error);
      else router.push(`/systems/${teamId}`);
    });
  }

  const byId = new Map(roster.map((p) => [p.playerId, p]));
  const formationSlots = FORMATIONS[lineup.formation] ?? [];
  const printStarters = lineup.slots
    .map((playerId, i) => {
      if (!playerId) return null;
      const p = byId.get(playerId);
      const base = formationSlots[i] ?? { x: 50, y: 50, role: "" };
      const pos = lineup.coords[i] ?? { x: base.x, y: base.y };
      return {
        jerseyNumber: p?.jerseyNumber ?? null,
        name: p?.fullName ?? "?",
        role: base.role,
        x: pos.x,
        y: pos.y,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const printGroups = [
    {
      label: tMatch("subsTitle"),
      players: lineup.subs
        .map((id) => byId.get(id))
        .filter((p): p is RosterPlayer => Boolean(p))
        .map((p) => ({ jerseyNumber: p.jerseyNumber, name: p.fullName })),
    },
  ].filter((g) => g.players.length > 0);
  const printPhases = phases.map((p) => ({
    id: p.id,
    systemName: name.trim() || t("title"),
    kind: p.kind,
    name: p.name || null,
    board: p.board,
  }));

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push(`/systems/${teamId}`)}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToList")}
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm">
          <Input
            id="system-name"
            label={t("nameLabel")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" />
            {t("print")}
          </Button>
          {systemId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              loading={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("delete")}
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={save} loading={isSaving}>
            <Save className="h-3.5 w-3.5" />
            {t("save")}
          </Button>
        </div>
      </div>

      {error ? (
        <span className="text-sm text-red-600 dark:text-red-400">
          {t.has(`err.${error}`) ? t(`err.${error}`) : error}
        </span>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("compoTitle")}
        </h2>
        {roster.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--club-line)] bg-white/40 p-4 text-sm text-zinc-500 dark:bg-zinc-900/30">
            {t("emptyRoster")}
          </p>
        ) : (
          <LineupBoard
            value={lineup}
            onChange={setLineup}
            roster={roster}
            unavailable={{}}
          />
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-[var(--club-line)] pt-5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("tacticsTitle")}
        </h2>
        <MatchTactics value={tactics} onChange={setTactics} />
      </section>

      <section className="flex flex-col gap-3 border-t border-[var(--club-line)] pt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t("phasesTitle")}
          </h2>
          <Button type="button" variant="secondary" size="sm" onClick={addPhase}>
            <Plus className="h-3.5 w-3.5" />
            {t("addPhase")}
          </Button>
        </div>
        {phases.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--club-line)] bg-white/40 p-4 text-sm text-zinc-500 dark:bg-zinc-900/30">
            {t("phasesEmpty")}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {phases.map((ph) => (
              <div
                key={ph.id}
                className="flex flex-col gap-3 rounded-lg border border-[var(--club-line)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={ph.kind}
                    onChange={(e) =>
                      patchPhase(ph.id, { kind: e.target.value as PhaseKind })
                    }
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    {PHASE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`phaseKind.${k}`)}
                      </option>
                    ))}
                  </select>
                  <input
                    value={ph.name}
                    onChange={(e) => patchPhase(ph.id, { name: e.target.value })}
                    placeholder={t("phaseNamePlaceholder")}
                    className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => removePhase(ph.id)}
                    className="text-zinc-400 transition hover:text-red-500"
                    aria-label={t("removePhase")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <PhaseBoard
                  value={ph.board}
                  onChange={(board) => patchPhase(ph.id, { board })}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <MatchPrintSheet
        title={name.trim() || t("title")}
        subtitle={t("printSubtitle")}
        formation={lineup.formation}
        starters={printStarters}
        groups={printGroups}
        tactics={tactics}
        phases={printPhases}
        includeSquadPage={false}
        clubLogoUrl={clubLogoUrl}
        labels={{
          formation: tMatch("formation"),
          tactics: tMatch("tacticsTitle"),
          matchContext: tMatch("tactics.matchContext"),
          structures: tMatch("tactics.structures"),
          objective: tMatch("tactics.objective"),
          general: tMatch("tactics.general"),
          possession: tMatch("tactics.possession"),
          defense: tMatch("tactics.defense"),
          loss: tMatch("tactics.loss"),
          regain: tMatch("tactics.regain"),
          transition: tMatch("tactics.transition"),
          squad: t("compoTitle"),
          starters: tMatch("summary.starters"),
          setPieces: t("phasesTitle"),
          reason: tMatch("summary.reason"),
          coach: tMatch("coach"),
        }}
      />
    </div>
  );
}
