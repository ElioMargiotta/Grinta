/**
 * Types & constantes partagés du module « Systèmes de jeu ».
 *
 * Un système est une compo réutilisable (formation + joueurs + tactique) plus des
 * phases arrêtées dessinées sur le terrain (jetons + flèches). Ces formes servent
 * à la fois aux server actions (validation) et aux composants client (édition).
 */

import type { TacticsValue } from "@/components/planner/MatchTactics";

/** Catégories de phases arrêtées. */
export const PHASE_KINDS = [
  "build_up",
  "press",
  "attack_corner",
  "defense_corner",
  "attack_freekick",
  "defense_freekick",
] as const;
export type PhaseKind = (typeof PHASE_KINDS)[number];

export type PhaseTokenKind =
  | "us"
  | "them"
  | "gk"
  | "ball"
  | "cone"
  | "goal-h"
  | "goal-v";
export type PhaseToken = {
  id: string;
  kind: PhaseTokenKind;
  x: number; // 0..100
  y: number; // 0..100
  label: string;
};
export type PhaseArrowKind = "run" | "pass" | "dribble" | "long-ball";
export type PhaseArrow = {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  kind: PhaseArrowKind;
};
export type PhaseBoardValue = { tokens: PhaseToken[]; arrows: PhaseArrow[] };

/** Compo d'un système, même forme que `LineupValue` (terrain par poste). */
export type SystemLineup = {
  slots: (string | null)[];
  coords: Record<number, { x: number; y: number }>;
  subs: string[];
};

export type TacticalPhase = {
  id: string;
  kind: PhaseKind;
  name: string | null;
  board: PhaseBoardValue;
};

export type TacticalSystem = {
  id: string;
  name: string;
  formation: string;
  lineup: SystemLineup;
  tactics: TacticsValue;
  phases: TacticalPhase[];
};

export const EMPTY_BOARD: PhaseBoardValue = { tokens: [], arrows: [] };

const clamp = (n: unknown): number =>
  Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

function asTactics(raw: unknown): TacticsValue {
  const o = (raw ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const objective = s("objective") || s("general");
  const loss = s("loss") || s("transition");
  return {
    coaches: s("coaches"),
    matchContext: s("matchContext"),
    structures: s("structures"),
    boards: {
      possession: parseBoard(
        (o.boards as Record<string, unknown> | undefined)?.possession,
      ),
      defense: parseBoard(
        (o.boards as Record<string, unknown> | undefined)?.defense,
      ),
      loss: parseBoard((o.boards as Record<string, unknown> | undefined)?.loss),
      regain: parseBoard(
        (o.boards as Record<string, unknown> | undefined)?.regain,
      ),
    },
    objective,
    general: s("general") || objective,
    possession: s("possession"),
    defense: s("defense"),
    loss,
    regain: s("regain"),
    transition: s("transition") || loss,
  };
}

/** Normalise un lineup brut (jsonb / formulaire) vers `SystemLineup`. */
export function parseLineup(raw: unknown): SystemLineup {
  const o = (raw ?? {}) as Record<string, unknown>;
  const slots = Array.isArray(o.slots)
    ? o.slots.map((v) => (typeof v === "string" && v ? v : null))
    : [];
  const coords: Record<number, { x: number; y: number }> = {};
  if (o.coords && typeof o.coords === "object") {
    for (const [k, v] of Object.entries(o.coords as Record<string, unknown>)) {
      const i = Number(k);
      const p = v as { x?: unknown; y?: unknown } | null;
      if (Number.isInteger(i) && p && typeof p === "object") {
        coords[i] = { x: clamp(p.x), y: clamp(p.y) };
      }
    }
  }
  const subs = Array.isArray(o.subs)
    ? o.subs.filter((v): v is string => typeof v === "string" && Boolean(v))
    : [];
  return { slots, coords, subs };
}

/** Normalise un board brut vers `PhaseBoardValue`, en bornant les coordonnées. */
export function parseBoard(raw: unknown): PhaseBoardValue {
  const o = (raw ?? {}) as Record<string, unknown>;
  const tokens: PhaseToken[] = Array.isArray(o.tokens)
    ? o.tokens
        .map((t) => t as Record<string, unknown>)
        .filter((t) =>
          t &&
          (
            ["us", "them", "gk", "ball", "cone", "goal-h", "goal-v"] as string[]
          ).includes(String(t.kind)),
        )
        .map((t) => ({
          id: String(t.id ?? crypto.randomUUID()),
          kind: t.kind as PhaseTokenKind,
          x: clamp(t.x),
          y: clamp(t.y),
          label: typeof t.label === "string" ? t.label.slice(0, 6) : "",
        }))
    : [];
  const arrows: PhaseArrow[] = Array.isArray(o.arrows)
    ? o.arrows
        .map((a) => a as Record<string, unknown>)
        .filter((a) =>
          a &&
          (["run", "pass", "dribble", "long-ball"] as string[]).includes(
            String(a.kind),
          ),
        )
        .map((a) => ({
          id: String(a.id ?? crypto.randomUUID()),
          fromX: clamp(a.fromX),
          fromY: clamp(a.fromY),
          toX: clamp(a.toX),
          toY: clamp(a.toY),
          kind: a.kind as PhaseArrowKind,
        }))
    : [];
  return { tokens, arrows };
}

/** Normalise la tactique d'un système. */
export function parseTactics(raw: unknown): TacticsValue {
  return asTactics(raw);
}
