"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, RotateCcw, X } from "lucide-react";
import { FullPitch } from "@/components/sheet/Pitch";
import { Jersey } from "@/components/planner/Jersey";
import type { RosterPlayer } from "@/components/planner/MatchParticipations";
import type { UnavailabilityKind } from "@/lib/availability/unavailability";
import {
  FORMATIONS,
  FORMATION_GROUPS,
  pitchLeftPct,
  pitchTopPct,
} from "@/components/planner/match/formations";

export type UnavailableMap = Record<
  string,
  { kind: UnavailabilityKind; reason: string | null }
>;

export type LineupValue = {
  formation: string;
  /** playerId par index de poste de formation (longueur 11), null = poste vide. */
  slots: (string | null)[];
  /** Surcharges de position (drag) par index de poste. */
  coords: Record<number, { x: number; y: number }>;
  /** Remplaçants, dans l'ordre d'ajout. */
  subs: string[];
};

const KIND_BADGE: Record<UnavailabilityKind, string> = {
  injury: "🩹",
  illness: "🤒",
  suspension: "🟥",
  other: "⛔",
};

const MARGIN_X = (2 / 72) * 100;
const SPAN_X = 68 / 72;
const MARGIN_Y = (2 / 109) * 100;
const SPAN_Y = 105 / 109;

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : full;
}

type PickerTarget = { kind: "slot"; index: number } | { kind: "sub" };

export function LineupBoard({
  value,
  onChange,
  roster,
  unavailable,
}: {
  value: LineupValue;
  onChange: (next: LineupValue) => void;
  roster: RosterPlayer[];
  unavailable: UnavailableMap;
}) {
  const t = useTranslations("planner.match.prematch");
  const tKind = useTranslations("planner.match.prematch.kind");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ index: number; moved: boolean } | null>(null);
  const [picker, setPicker] = useState<PickerTarget | null>(null);

  const byId = new Map(roster.map((p) => [p.playerId, p]));
  const slotCoords = FORMATIONS[value.formation] ?? [];
  const startersCount = value.slots.filter((s) => s !== null).length;

  // Joueurs déjà engagés (titulaires + remplaçants) → exclus du picker.
  const usedIds = new Set<string>(value.subs);
  for (const id of value.slots) if (id) usedIds.add(id);
  const available = roster.filter((p) => !usedIds.has(p.playerId));

  function applyFormation(name: string) {
    // Conserve les affectations par index, repositionne aux postes du préset.
    onChange({ ...value, formation: name, coords: {} });
  }

  function assignSlot(index: number, playerId: string) {
    const slots = value.slots.slice();
    slots[index] = playerId;
    // Retire le joueur d'un éventuel rôle de remplaçant.
    const subs = value.subs.filter((id) => id !== playerId);
    onChange({ ...value, slots, subs });
    setPicker(null);
  }

  function clearSlot(index: number) {
    const slots = value.slots.slice();
    slots[index] = null;
    const coords = { ...value.coords };
    delete coords[index];
    onChange({ ...value, slots, coords });
    setPicker(null);
  }

  function addSub(playerId: string) {
    if (value.subs.includes(playerId)) return;
    onChange({ ...value, subs: [...value.subs, playerId] });
    setPicker(null);
  }

  function resetLineup() {
    if (startersCount === 0 && value.subs.length === 0) return;
    if (!window.confirm(t("resetConfirm"))) return;
    onChange({
      ...value,
      slots: Array(slotCoords.length).fill(null),
      coords: {},
      subs: [],
    });
  }

  function removeSub(playerId: string) {
    onChange({ ...value, subs: value.subs.filter((id) => id !== playerId) });
  }

  function onTokenPointerDown(index: number, e: React.PointerEvent) {
    e.preventDefault();
    dragRef.current = { index, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onTokenPointerMove(index: number, e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.index !== index) return;
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const leftPct = ((e.clientX - r.left) / r.width) * 100;
    const topPct = ((e.clientY - r.top) / r.height) * 100;
    const x = Math.max(0, Math.min(100, (leftPct - MARGIN_X) / SPAN_X));
    const y = Math.max(0, Math.min(100, (topPct - MARGIN_Y) / SPAN_Y));
    drag.moved = true;
    onChange({ ...value, coords: { ...value.coords, [index]: { x, y } } });
  }

  function onTokenPointerUp(index: number) {
    const drag = dragRef.current;
    dragRef.current = null;
    // Tap sans déplacement → ouvre le menu du poste (remplacer / retirer).
    if (drag && !drag.moved) setPicker({ kind: "slot", index });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barre formation */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {t("formation")}
          </span>
          <select
            value={value.formation}
            onChange={(e) => applyFormation(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {FORMATION_GROUPS.map((g) => (
              <optgroup key={g.label} label={t("defenders", { count: g.label })}>
                {g.names.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <span className="text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
          {t("startersOf", { count: startersCount })}
        </span>
        <button
          type="button"
          onClick={resetLineup}
          disabled={startersCount === 0 && value.subs.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--club-line)] px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800/40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("reset")}
        </button>
      </div>

      {/* Terrain — clic sur un poste pour placer un joueur */}
      <div
        ref={boxRef}
        className="relative mx-auto w-full max-w-[420px] select-none rounded-lg bg-emerald-700/90 dark:bg-emerald-900/70"
        style={{ aspectRatio: "72 / 109", touchAction: "none" }}
      >
        <FullPitch className="absolute inset-0 h-full w-full !text-white/60" />
        {slotCoords.map((slot, i) => {
          const pos = value.coords[i] ?? { x: slot.x, y: slot.y };
          const playerId = value.slots[i] ?? null;
          const p = playerId ? byId.get(playerId) : null;
          const unav = playerId ? unavailable[playerId] : undefined;
          const style = {
            left: `${pitchLeftPct(pos.x)}%`,
            top: `${pitchTopPct(pos.y)}%`,
            width: "22%",
          } as const;

          if (!p) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => setPicker({ kind: "slot", index: i })}
                className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={style}
                aria-label={t("pickPlayer")}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-white/70 text-white/90 transition group-hover:border-white group-hover:bg-white/15">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <span className="mt-0.5 rounded bg-black/35 px-1 text-[9px] font-medium uppercase leading-tight text-white/90">
                  {slot.role}
                </span>
              </button>
            );
          }

          return (
            <div
              key={i}
              onPointerDown={(e) => onTokenPointerDown(i, e)}
              onPointerMove={(e) => onTokenPointerMove(i, e)}
              onPointerUp={() => onTokenPointerUp(i)}
              onPointerCancel={() => onTokenPointerUp(i)}
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center active:cursor-grabbing"
              style={style}
            >
              <span className="relative flex h-9 w-9 items-center justify-center">
                <Jersey
                  number={p.jerseyNumber ?? "—"}
                  tone={unav ? "danger" : "default"}
                  className="h-9 w-9 drop-shadow"
                />
                {unav ? (
                  <span
                    title={tKind(unav.kind)}
                    className="absolute -right-1 -top-1 text-[11px] leading-none"
                  >
                    {KIND_BADGE[unav.kind]}
                  </span>
                ) : null}
              </span>
              <span
                className={`mt-0.5 max-w-full truncate rounded px-1 text-[9px] font-medium leading-tight text-white ${
                  unav ? "bg-red-600/85" : "bg-black/45"
                }`}
              >
                {lastName(p.fullName)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Remplaçants */}
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {t("subsTitle")}
        </div>
        {value.subs.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("subsEmpty")}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {value.subs.map((id) => {
              const p = byId.get(id);
              if (!p) return null;
              const unav = unavailable[id];
              return (
                <li
                  key={id}
                  className="group inline-flex items-center gap-2 rounded-full border border-[var(--club-line)] bg-white py-1 pl-1.5 pr-2.5 text-sm dark:bg-zinc-900"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold tabular-nums dark:bg-zinc-800">
                    {p.jerseyNumber ?? "—"}
                  </span>
                  <span className="truncate text-zinc-900 dark:text-zinc-100">
                    {lastName(p.fullName)}
                  </span>
                  {unav ? <span title={tKind(unav.kind)}>{KIND_BADGE[unav.kind]}</span> : null}
                  <button
                    type="button"
                    onClick={() => removeSub(id)}
                    className="ml-0.5 text-zinc-400 transition hover:text-red-500"
                    aria-label={t("removeSub")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setPicker({ kind: "sub" })}
          disabled={available.length === 0}
          className="w-fit rounded-md border border-dashed border-[var(--club-line)] px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800/40"
        >
          + {t("addSub")}
        </button>
      </div>

      {picker ? (
        <PlayerPicker
          title={picker.kind === "sub" ? t("addSub") : t("pickPlayer")}
          players={available}
          unavailable={unavailable}
          tKind={tKind}
          onPick={(playerId) =>
            picker.kind === "sub"
              ? addSub(playerId)
              : assignSlot(picker.index, playerId)
          }
          onClear={
            picker.kind === "slot" && value.slots[picker.index]
              ? () => clearSlot(picker.index)
              : undefined
          }
          clearLabel={t("removeFromSlot")}
          emptyLabel={t("pickerEmpty")}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}

function PlayerPicker({
  title,
  players,
  unavailable,
  tKind,
  onPick,
  onClear,
  clearLabel,
  emptyLabel,
  onClose,
}: {
  title: string;
  players: RosterPlayer[];
  unavailable: UnavailableMap;
  tKind: ReturnType<typeof useTranslations<"planner.match.prematch.kind">>;
  onPick: (playerId: string) => void;
  onClear?: () => void;
  clearLabel: string;
  emptyLabel: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--club-line)] px-4 py-3">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-1">
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="mb-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <X className="h-4 w-4" />
              {clearLabel}
            </button>
          ) : null}
          {players.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {emptyLabel}
            </p>
          ) : (
            players.map((p) => {
              const unav = unavailable[p.playerId];
              return (
                <button
                  key={p.playerId}
                  type="button"
                  onClick={() => onPick(p.playerId)}
                  className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-semibold tabular-nums ${
                      unav
                        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        : "bg-zinc-100 dark:bg-zinc-800"
                    }`}
                  >
                    {p.jerseyNumber ?? "—"}
                  </span>
                  <span
                    className={`truncate ${
                      unav
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {p.fullName}
                  </span>
                  {unav ? (
                    <span className="ml-auto shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      {KIND_BADGE[unav.kind]} {tKind(unav.kind)}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
