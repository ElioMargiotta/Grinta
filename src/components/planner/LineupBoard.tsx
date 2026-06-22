"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { FullPitch } from "@/components/sheet/Pitch";
import type { RosterPlayer } from "@/components/planner/MatchParticipations";
import {
  FORMATIONS,
  FORMATION_NAMES,
  pitchLeftPct,
  pitchTopPct,
} from "@/components/planner/match/formations";

export type Starter = { playerId: string; x: number; y: number; role: string };
export type BenchRole = "substitute" | "unused";
export type LineupValue = {
  formation: string;
  starters: Starter[];
  bench: Record<string, BenchRole>;
};

const MARGIN_X = (2 / 72) * 100;
const SPAN_X = 68 / 72;
const MARGIN_Y = (2 / 109) * 100;
const SPAN_Y = 105 / 109;

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : full;
}

export function LineupBoard({
  value,
  onChange,
  convened,
}: {
  value: LineupValue;
  onChange: (next: LineupValue) => void;
  convened: RosterPlayer[];
}) {
  const t = useTranslations("planner.match.prematch");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ playerId: string; moved: boolean } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const byId = new Map(convened.map((p) => [p.playerId, p]));
  const starterIds = new Set(value.starters.map((s) => s.playerId));
  const benchPlayers = convened.filter((p) => !starterIds.has(p.playerId));

  function applyFormation(name: string) {
    const coords = FORMATIONS[name] ?? [];
    const starters = value.starters.map((s, i) => ({
      ...s,
      x: coords[i]?.x ?? s.x,
      y: coords[i]?.y ?? s.y,
      role: coords[i]?.role ?? s.role,
    }));
    onChange({ ...value, formation: name, starters });
  }

  function addStarter(playerId: string) {
    if (value.starters.length >= 11) return;
    const coords = FORMATIONS[value.formation] ?? [];
    const slot = coords[value.starters.length] ?? { role: "", x: 50, y: 50 };
    const bench = { ...value.bench };
    delete bench[playerId];
    onChange({
      ...value,
      bench,
      starters: [
        ...value.starters,
        { playerId, x: slot.x, y: slot.y, role: slot.role },
      ],
    });
    setAddOpen(false);
  }

  function removeStarter(playerId: string) {
    onChange({
      ...value,
      starters: value.starters.filter((s) => s.playerId !== playerId),
      bench: { ...value.bench, [playerId]: "substitute" },
    });
  }

  function setBenchRole(playerId: string, role: BenchRole) {
    onChange({ ...value, bench: { ...value.bench, [playerId]: role } });
  }

  function onTokenPointerDown(playerId: string, e: React.PointerEvent) {
    e.preventDefault();
    dragRef.current = { playerId, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onTokenPointerMove(playerId: string, e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.playerId !== playerId) return;
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const leftPct = ((e.clientX - r.left) / r.width) * 100;
    const topPct = ((e.clientY - r.top) / r.height) * 100;
    const x = Math.max(0, Math.min(100, (leftPct - MARGIN_X) / SPAN_X));
    const y = Math.max(0, Math.min(100, (topPct - MARGIN_Y) / SPAN_Y));
    drag.moved = true;
    onChange({
      ...value,
      starters: value.starters.map((s) =>
        s.playerId === playerId ? { ...s, x, y } : s,
      ),
    });
  }

  function onTokenPointerUp() {
    dragRef.current = null;
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
            {FORMATION_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
          {t("startersOf", { count: value.starters.length })}
        </span>
      </div>

      {/* Terrain */}
      <div
        ref={boxRef}
        className="relative mx-auto w-full max-w-[420px] select-none rounded-lg bg-emerald-700/90 dark:bg-emerald-900/70"
        style={{ aspectRatio: "72 / 109", touchAction: "none" }}
      >
        <FullPitch className="absolute inset-0 h-full w-full !text-white/60" />
        {value.starters.map((s) => {
          const p = byId.get(s.playerId);
          return (
            <div
              key={s.playerId}
              onPointerDown={(e) => onTokenPointerDown(s.playerId, e)}
              onPointerMove={(e) => onTokenPointerMove(s.playerId, e)}
              onPointerUp={onTokenPointerUp}
              onPointerCancel={onTokenPointerUp}
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center active:cursor-grabbing"
              style={{
                left: `${pitchLeftPct(s.x)}%`,
                top: `${pitchTopPct(s.y)}%`,
                width: "22%",
              }}
            >
              <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[var(--club-primary)] text-[11px] font-bold tabular-nums text-white shadow ring-2 ring-white/80">
                {p?.jerseyNumber ?? "—"}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeStarter(s.playerId)}
                  className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white group-hover:flex"
                  aria-label={t("removeStarter")}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
              <span className="mt-0.5 max-w-full truncate rounded bg-black/45 px-1 text-[9px] font-medium leading-tight text-white">
                {p ? lastName(p.fullName) : "?"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Ajout titulaire */}
      {value.starters.length < 11 ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            disabled={benchPlayers.length === 0}
            className="rounded-md border border-dashed border-[var(--club-line)] px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800/40"
          >
            + {t("addStarter")}
          </button>
          {addOpen && benchPlayers.length > 0 ? (
            <div className="absolute z-10 mt-1 max-h-56 w-64 overflow-auto rounded-md border border-[var(--club-line)] bg-white p-1 shadow-lg dark:bg-zinc-900">
              {benchPlayers.map((p) => (
                <button
                  key={p.playerId}
                  type="button"
                  onClick={() => addStarter(p.playerId)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-zinc-100 text-[10px] font-semibold tabular-nums dark:bg-zinc-800">
                    {p.jerseyNumber ?? "—"}
                  </span>
                  {p.fullName}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Banc */}
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {t("bench")}
        </div>
        {benchPlayers.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("benchEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--club-line)] overflow-hidden rounded-lg border border-[var(--club-line)]">
            {benchPlayers.map((p) => {
              const role = value.bench[p.playerId] ?? "substitute";
              return (
                <li
                  key={p.playerId}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-[11px] font-semibold tabular-nums dark:bg-zinc-800">
                      {p.jerseyNumber ?? "—"}
                    </span>
                    <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">
                      {p.fullName}
                    </span>
                  </span>
                  <div className="flex shrink-0 overflow-hidden rounded-md border border-[var(--club-line)] text-xs">
                    {(["substitute", "unused"] as BenchRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setBenchRole(p.playerId, r)}
                        className={`px-2 py-1 font-medium transition ${
                          role === r
                            ? "bg-[var(--club-primary)] text-white"
                            : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300"
                        }`}
                      >
                        {t(`benchRole.${r}`)}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
