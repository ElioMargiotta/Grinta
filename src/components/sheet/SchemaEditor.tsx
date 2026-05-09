"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_SCHEMA_SETTINGS,
  type SchemaSettings,
  type SchemaSettingsKey,
  useSchemaSettings,
} from "./schemaSettings";
import type { SchemaData, SchemaShape } from "./types";

/* ============================================================
 * Schema editor — small SVG canvas where the coach drops players,
 * cones, the ball and arrows over the pitch printed on the PDF.
 *
 * Coordinates live in a fixed viewBox (VB_W × VB_H). Both the
 * editor and the PDF re-render the same shapes inside their own
 * <svg viewBox="..."> — so scaling stays clean.
 * ============================================================ */

/* viewBox aligned with public/demi-terrain.svg (147 × 105) so the on-screen
 * editor and the printed pitch share exactly the same aspect ratio. */
export const VB_W = 147;
export const VB_H = 105;

export type PitchKind = "half" | "full-vertical" | "full-horizontal";

export type Pitch = {
  src: string;
  vbW: number;
  vbH: number;
  /* maxWidth controls the editor's on-screen size — full pitches are
   * taller, so we narrow them to keep the canvas height reasonable. */
  maxWidth: number;
};

const PITCHES: Record<PitchKind, Pitch> = {
  half: { src: "/demi-terrain.svg", vbW: 147, vbH: 105, maxWidth: 460 },
  "full-vertical": {
    src: "/terrain-vertical.svg",
    vbW: 142.5,
    vbH: 201,
    maxWidth: 320,
  },
  "full-horizontal": {
    src: "/terrain-horizontale.svg",
    vbW: 126.75,
    vbH: 90,
    maxWidth: 520,
  },
};

const DEFAULT_PITCH: PitchKind = "half";

/* base sizes (in viewBox units) — multiplied by settings.symbolSize at render */
const PLAYER_R = 5.2;
const BALL_R = 2.4;
const CONE_R = 3;
const GOAL_LONG = 14;
const GOAL_SHORT = 3;

const SETTINGS_LABELS: Record<SchemaSettingsKey, string> = {
  warmup: "échauffement",
  block: "bloc principal",
  game: "jeu final",
  default: "schémas",
};

type Tool =
  | "select"
  | "home"
  | "away"
  | "gk"
  | "ball"
  | "cone"
  | "goal-h"
  | "goal-v"
  | "line"
  | "arrow-run"
  | "arrow-pass"
  | "arrow-dribble"
  | "arrow-long-ball";

function nextId() {
  return `s_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function nextLabel(shapes: SchemaShape[], team: "home" | "away") {
  const n = shapes.filter((s) => s.kind === "player" && s.team === team).length;
  return String(n + 1);
}

/* Wave path (used for "dribble" arrows). Goes from (x1,y1) to (x2,y2)
 * with sinusoidal-like quadratic curves perpendicular to the chord.
 * Endpoints sit on the chord, so the polygon arrow head meets the wave
 * cleanly without a kink. */
function buildWavePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  amp: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const wavelength = Math.max(6, amp * 4);
  const segments = Math.max(2, Math.round((len / wavelength) * 2));
  let d = `M ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  for (let i = 1; i <= segments; i++) {
    const tCtrl = (i - 0.5) / segments;
    const tEnd = i / segments;
    const sign = i % 2 === 1 ? 1 : -1;
    const cx = x1 + ux * len * tCtrl + px * amp * sign;
    const cy = y1 + uy * len * tCtrl + py * amp * sign;
    const ex = x1 + ux * len * tEnd;
    const ey = y1 + uy * len * tEnd;
    d += ` Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  }
  return d;
}

/* Curved path split before the arrow head. Returns the path data, the
 * point where the path stops (= arrow base midpoint), and the unit
 * tangent direction at that point so the polygon head sits flush. */
function buildSplitCurvedPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  arc: number,
  headLen: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) {
    return {
      d: `M ${x1} ${y1} L ${x2} ${y2}`,
      base: { x: x1, y: y1 },
      tipUx: 1,
      tipUy: 0,
    };
  }
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const a = Math.min(len * 0.35, arc);
  const cx = (x1 + x2) / 2 + px * a;
  const cy = (y1 + y2) / 2 + py * a;

  // Find t such that |B(t) - P2| ≈ headLen via binary search.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const t = (lo + hi) / 2;
    const u = 1 - t;
    const bx = u * u * x1 + 2 * u * t * cx + t * t * x2;
    const by = u * u * y1 + 2 * u * t * cy + t * t * y2;
    const d = Math.hypot(x2 - bx, y2 - by);
    if (d > headLen) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2;
  // de Casteljau split at t
  const ax = x1 + (cx - x1) * t;
  const ay = y1 + (cy - y1) * t;
  const bx = cx + (x2 - cx) * t;
  const by = cy + (y2 - cy) * t;
  const mx = ax + (bx - ax) * t;
  const my = ay + (by - ay) * t;

  const tdx = x2 - mx;
  const tdy = y2 - my;
  const tlen = Math.hypot(tdx, tdy) || 1;
  return {
    d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${ax.toFixed(2)} ${ay.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`,
    base: { x: mx, y: my },
    tipUx: tdx / tlen,
    tipUy: tdy / tlen,
  };
}

/* ----- Read-only renderer (also used by PDF export) ----- */
export function SchemaView({
  data,
  pitch = DEFAULT_PITCH,
  settingsKey = "default",
}: {
  data: SchemaData;
  pitch?: PitchKind;
  settingsKey?: SchemaSettingsKey;
}) {
  const [settings] = useSchemaSettings(settingsKey);
  const p = PITCHES[pitch];
  return (
    <svg
      viewBox={`0 0 ${p.vbW} ${p.vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full"
    >
      <SchemaShapes data={data} settings={settings} />
    </svg>
  );
}

function SchemaShapes({
  data,
  settings,
  selectedId,
  onShapePointerDown,
  editable = false,
}: {
  data: SchemaData;
  settings: SchemaSettings;
  selectedId?: string | null;
  onShapePointerDown?: (s: SchemaShape, e: React.PointerEvent) => void;
  editable?: boolean;
}) {
  const playerR = PLAYER_R * settings.symbolSize;
  const ballR = BALL_R * settings.symbolSize;
  const coneR = CONE_R * settings.symbolSize;
  const goalLong = GOAL_LONG * settings.symbolSize;
  const goalShort = GOAL_SHORT * settings.symbolSize;

  return (
    <>
      {data.shapes.map((s) => {
        const selected = !!editable && s.id === selectedId;
        const onDown = (e: React.PointerEvent) => onShapePointerDown?.(s, e);
        const ringStroke = selected ? "#0ea5e9" : "white";
        const ringWidth = selected ? 1.2 : 0.6;

        if (s.kind === "player") {
          const teamColor =
            s.team === "home"
              ? settings.colors.home
              : s.team === "away"
                ? settings.colors.away
                : settings.colors.gk;
          const fill = s.color ?? teamColor;
          const textColor = s.team === "gk" ? "#111827" : "white";
          return (
            <g
              key={s.id}
              onPointerDown={onDown}
              style={{ cursor: editable ? "pointer" : "default" }}
            >
              <circle
                cx={s.x}
                cy={s.y}
                r={playerR}
                fill={fill}
                stroke={ringStroke}
                strokeWidth={ringWidth}
              />
              {s.label && (
                <text
                  x={s.x}
                  y={s.y + playerR * 0.38}
                  textAnchor="middle"
                  fontSize={playerR * 1.05}
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fontWeight="700"
                  fill={textColor}
                  pointerEvents="none"
                >
                  {s.label}
                </text>
              )}
            </g>
          );
        }
        if (s.kind === "ball") {
          return (
            <g
              key={s.id}
              onPointerDown={onDown}
              style={{ cursor: editable ? "pointer" : "default" }}
            >
              <circle
                cx={s.x}
                cy={s.y}
                r={ballR}
                fill={s.color ?? settings.colors.ball}
                stroke={ringStroke}
                strokeWidth={selected ? 0.9 : 0.4}
              />
            </g>
          );
        }
        if (s.kind === "cone") {
          const tri = `M ${s.x} ${s.y - coneR} L ${s.x + coneR} ${s.y + coneR * 0.75} L ${s.x - coneR} ${s.y + coneR * 0.75} Z`;
          return (
            <path
              key={s.id}
              d={tri}
              fill={s.color ?? settings.colors.cone}
              stroke={selected ? "#0ea5e9" : "#7c2d12"}
              strokeWidth={selected ? 0.9 : 0.4}
              strokeLinejoin="round"
              onPointerDown={onDown}
              style={{ cursor: editable ? "pointer" : "default" }}
            />
          );
        }
        if (s.kind === "goal") {
          const w = s.orientation === "h" ? goalLong : goalShort;
          const h = s.orientation === "h" ? goalShort : goalLong;
          const stroke = selected ? "#0ea5e9" : (s.color ?? "#111827");
          return (
            <g
              key={s.id}
              onPointerDown={onDown}
              style={{ cursor: editable ? "pointer" : "default" }}
            >
              <rect
                x={s.x - w / 2}
                y={s.y - h / 2}
                width={w}
                height={h}
                fill="white"
                stroke={stroke}
                strokeWidth={selected ? 0.9 : 0.6}
              />
              {/* Posts: two short ticks at the goal-mouth ends to make the
               * orientation obvious even at small sizes. */}
              {s.orientation === "h" ? (
                <>
                  <line
                    x1={s.x - w / 2}
                    y1={s.y - h / 2 - 0.6}
                    x2={s.x - w / 2}
                    y2={s.y - h / 2 + 0.6}
                    stroke={stroke}
                    strokeWidth={0.8}
                  />
                  <line
                    x1={s.x + w / 2}
                    y1={s.y - h / 2 - 0.6}
                    x2={s.x + w / 2}
                    y2={s.y - h / 2 + 0.6}
                    stroke={stroke}
                    strokeWidth={0.8}
                  />
                </>
              ) : (
                <>
                  <line
                    x1={s.x - w / 2 - 0.6}
                    y1={s.y - h / 2}
                    x2={s.x - w / 2 + 0.6}
                    y2={s.y - h / 2}
                    stroke={stroke}
                    strokeWidth={0.8}
                  />
                  <line
                    x1={s.x - w / 2 - 0.6}
                    y1={s.y + h / 2}
                    x2={s.x - w / 2 + 0.6}
                    y2={s.y + h / 2}
                    stroke={stroke}
                    strokeWidth={0.8}
                  />
                </>
              )}
            </g>
          );
        }
        if (s.kind === "line") {
          const lineW = s.strokeWidth ?? settings.lineWidth;
          const color = selected ? "#0ea5e9" : (s.color ?? settings.colors.line);
          return (
            <g
              key={s.id}
              style={{ color, cursor: editable ? "pointer" : "default" }}
              onPointerDown={onDown}
            >
              <line
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke="currentColor"
                strokeWidth={lineW}
                strokeLinecap="round"
              />
              {editable && (
                <line
                  x1={s.x1}
                  y1={s.y1}
                  x2={s.x2}
                  y2={s.y2}
                  stroke="transparent"
                  strokeWidth={Math.max(lineW * 5, 4)}
                  strokeLinecap="round"
                />
              )}
            </g>
          );
        }

        // arrow — head drawn as an inline polygon so it survives PDF
        // rasterization (SVG <marker> elements get dropped by some print
        // pipelines or rendered with the wrong color). The line is trimmed
        // back so the polygon meets the path cleanly at the head base —
        // straight & wave use chord back-off, curved splits the bezier.
        const stroke = s.strokeWidth ?? settings.arrowWidth;
        const arrowColor = s.color ?? settings.colors.arrow;
        const color = selected ? "#0ea5e9" : arrowColor;

        const dx = s.x2 - s.x1;
        const dy = s.y2 - s.y1;
        const chordLen = Math.hypot(dx, dy);
        const headLen = Math.min(stroke * 3.5, Math.max(chordLen * 0.45, 0));
        const headHalfW = headLen * 0.5;

        let pathD: string;
        let baseX: number;
        let baseY: number;
        let tipUx: number;
        let tipUy: number;

        if (chordLen < 0.5) {
          pathD = `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`;
          baseX = s.x1;
          baseY = s.y1;
          tipUx = 1;
          tipUy = 0;
        } else {
          const ux = dx / chordLen;
          const uy = dy / chordLen;
          if (s.style === "long-ball") {
            const split = buildSplitCurvedPath(
              s.x1,
              s.y1,
              s.x2,
              s.y2,
              14,
              headLen,
            );
            pathD = split.d;
            baseX = split.base.x;
            baseY = split.base.y;
            tipUx = split.tipUx;
            tipUy = split.tipUy;
          } else {
            baseX = s.x2 - ux * headLen;
            baseY = s.y2 - uy * headLen;
            tipUx = ux;
            tipUy = uy;
            if (s.style === "dribble") {
              pathD = buildWavePath(
                s.x1,
                s.y1,
                baseX,
                baseY,
                1.6 * settings.symbolSize,
              );
            } else {
              pathD = `M ${s.x1} ${s.y1} L ${baseX.toFixed(2)} ${baseY.toFixed(2)}`;
            }
          }
        }

        const dasharray =
          s.style === "pass"
            ? `${(stroke * 2.4).toFixed(2)} ${(stroke * 1.6).toFixed(2)}`
            : undefined;

        const perpX = -tipUy;
        const perpY = tipUx;
        const c1x = baseX + perpX * headHalfW;
        const c1y = baseY + perpY * headHalfW;
        const c2x = baseX - perpX * headHalfW;
        const c2y = baseY - perpY * headHalfW;

        return (
          <g
            key={s.id}
            style={{ color, cursor: editable ? "pointer" : "default" }}
            onPointerDown={onDown}
          >
            <path
              d={pathD}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {chordLen > 0.5 && headLen > 0 && (
              <polygon
                points={`${s.x2.toFixed(2)},${s.y2.toFixed(2)} ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)}`}
                fill="currentColor"
                stroke="currentColor"
                strokeWidth={stroke * 0.4}
                strokeLinejoin="round"
              />
            )}
            {editable && (
              <>
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(stroke * 5, 4)}
                  strokeLinecap="round"
                />
                <line
                  x1={baseX}
                  y1={baseY}
                  x2={s.x2}
                  y2={s.y2}
                  stroke="transparent"
                  strokeWidth={Math.max(stroke * 5, 4)}
                  strokeLinecap="round"
                />
              </>
            )}
          </g>
        );
      })}
    </>
  );
}

/* ----- Editor ----- */
export function SchemaEditor({
  value,
  onChange,
  pitch = DEFAULT_PITCH,
  settingsKey = "default",
  showHint = true,
}: {
  value: SchemaData;
  onChange: (next: SchemaData) => void;
  pitch?: PitchKind;
  settingsKey?: SchemaSettingsKey;
  showHint?: boolean;
}) {
  const [settings, setSettings] = useSchemaSettings(settingsKey);
  const pitchCfg = PITCHES[pitch];
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<SchemaData[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<
    | { kind: "arrow"; id: string }
    | { kind: "line"; id: string }
    | { kind: "shape"; id: string; lastX: number; lastY: number }
    | null
  >(null);

  const selectedShape =
    selectedId != null
      ? value.shapes.find((s) => s.id === selectedId) ?? null
      : null;

  function commit(next: SchemaData, snapshot: SchemaData = value) {
    setHistory((h) => [...h.slice(-29), snapshot]);
    onChange(next);
  }

  function clientToVb(e: { clientX: number; clientY: number }) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * pitchCfg.vbW;
    const y = ((e.clientY - r.top) / r.height) * pitchCfg.vbH;
    return {
      x: Math.max(0, Math.min(pitchCfg.vbW, x)),
      y: Math.max(0, Math.min(pitchCfg.vbH, y)),
    };
  }

  function onCanvasPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (tool === "select") {
      setSelectedId(null);
      return;
    }
    const p = clientToVb(e);
    const id = nextId();

    if (tool === "home" || tool === "away") {
      commit({
        shapes: [
          ...value.shapes,
          {
            id,
            kind: "player",
            team: tool,
            label: nextLabel(value.shapes, tool),
            x: p.x,
            y: p.y,
          },
        ],
      });
      return;
    }
    if (tool === "gk") {
      commit({
        shapes: [
          ...value.shapes,
          { id, kind: "player", team: "gk", label: "G", x: p.x, y: p.y },
        ],
      });
      return;
    }
    if (tool === "ball") {
      commit({ shapes: [...value.shapes, { id, kind: "ball", x: p.x, y: p.y }] });
      return;
    }
    if (tool === "cone") {
      commit({ shapes: [...value.shapes, { id, kind: "cone", x: p.x, y: p.y }] });
      return;
    }
    if (tool === "goal-h" || tool === "goal-v") {
      commit({
        shapes: [
          ...value.shapes,
          {
            id,
            kind: "goal",
            orientation: tool === "goal-h" ? "h" : "v",
            x: p.x,
            y: p.y,
          },
        ],
      });
      return;
    }
    if (tool === "line") {
      commit({
        shapes: [
          ...value.shapes,
          { id, kind: "line", x1: p.x, y1: p.y, x2: p.x, y2: p.y },
        ],
      });
      dragRef.current = { kind: "line", id };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (
      tool === "arrow-run" ||
      tool === "arrow-pass" ||
      tool === "arrow-dribble" ||
      tool === "arrow-long-ball"
    ) {
      const style =
        tool === "arrow-run"
          ? "run"
          : tool === "arrow-pass"
            ? "pass"
            : tool === "arrow-dribble"
              ? "dribble"
              : "long-ball";
      commit({
        shapes: [
          ...value.shapes,
          { id, kind: "arrow", style, x1: p.x, y1: p.y, x2: p.x, y2: p.y },
        ],
      });
      dragRef.current = { kind: "arrow", id };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }

  function onCanvasPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const p = clientToVb(e);
    if (drag.kind === "arrow" || drag.kind === "line") {
      onChange({
        shapes: value.shapes.map((s) => {
          if (s.id !== drag.id) return s;
          if (s.kind === "arrow" || s.kind === "line") {
            return { ...s, x2: p.x, y2: p.y };
          }
          return s;
        }),
      });
    } else {
      const dx = p.x - drag.lastX;
      const dy = p.y - drag.lastY;
      drag.lastX = p.x;
      drag.lastY = p.y;
      onChange({
        shapes: value.shapes.map((s) => {
          if (s.id !== drag.id) return s;
          if (s.kind === "arrow" || s.kind === "line") {
            return {
              ...s,
              x1: s.x1 + dx,
              y1: s.y1 + dy,
              x2: s.x2 + dx,
              y2: s.y2 + dy,
            };
          }
          return { ...s, x: s.x + dx, y: s.y + dy };
        }),
      });
    }
  }

  function onCanvasPointerUp() {
    const drag = dragRef.current;
    if (drag?.kind === "arrow" || drag?.kind === "line") {
      const a = value.shapes.find((s) => s.id === drag.id);
      if (a && (a.kind === "arrow" || a.kind === "line")) {
        const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
        if (len < 10) {
          // discard a 0-length stroke (treat as a stray click)
          onChange({ shapes: value.shapes.filter((s) => s.id !== drag.id) });
        }
      }
    }
    dragRef.current = null;
  }

  function onShapePointerDown(s: SchemaShape, e: React.PointerEvent) {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelectedId(s.id);
    const p = clientToVb(e);
    dragRef.current = { kind: "shape", id: s.id, lastX: p.x, lastY: p.y };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }

  function undo() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    onChange(last);
    setSelectedId(null);
  }

  function clearAll() {
    if (value.shapes.length === 0) return;
    commit({ shapes: [] });
    setSelectedId(null);
  }

  function deleteSelected() {
    if (!selectedId) return;
    commit({ shapes: value.shapes.filter((s) => s.id !== selectedId) });
    setSelectedId(null);
  }

  function setSelectedColor(color: string) {
    if (!selectedId) return;
    commit({
      shapes: value.shapes.map((s) =>
        s.id === selectedId ? withColor(s, color) : s,
      ),
    });
  }

  function setSelectedStrokeWidth(width: number) {
    if (!selectedId) return;
    commit({
      shapes: value.shapes.map((s) =>
        s.id === selectedId ? withStrokeWidth(s, width) : s,
      ),
    });
  }

  function clearSelectedOverrides() {
    if (!selectedId) return;
    commit({
      shapes: value.shapes.map((s) => {
        if (s.id !== selectedId) return s;
        const next = { ...s };
        delete (next as { color?: string }).color;
        if (s.kind === "line" || s.kind === "arrow") {
          delete (next as { strokeWidth?: number }).strokeWidth;
        }
        return next as SchemaShape;
      }),
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // deleteSelected uses latest value via closure — re-bind on change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, value]);

  const cursor =
    tool === "select"
      ? "default"
      : tool.startsWith("arrow-") || tool === "line"
        ? "crosshair"
        : "copy";

  return (
    <div className="rounded-md border border-zinc-200 bg-white">
      <Toolbar
        tool={tool}
        setTool={setTool}
        canUndo={history.length > 0}
        canDelete={!!selectedId}
        canClear={value.shapes.length > 0}
        onUndo={undo}
        onDelete={deleteSelected}
        onClear={clearAll}
        settings={settings}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((v) => !v)}
      />
      {selectedShape && (
        <SelectionPanel
          shape={selectedShape}
          settings={settings}
          onColorChange={setSelectedColor}
          onStrokeChange={setSelectedStrokeWidth}
          onReset={clearSelectedOverrides}
          onClose={() => setSelectedId(null)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          settingsKey={settingsKey}
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      <div className="flex justify-center px-2 pb-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${pitchCfg.vbW} ${pitchCfg.vbH}`}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full rounded-sm"
          style={{
            touchAction: "none",
            aspectRatio: `${pitchCfg.vbW} / ${pitchCfg.vbH}`,
            maxWidth: pitchCfg.maxWidth,
            cursor,
          }}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
        >
          <PitchBackground pitch={pitchCfg} />
          <SchemaShapes
            data={value}
            settings={settings}
            editable
            selectedId={selectedId}
            onShapePointerDown={onShapePointerDown}
          />
        </svg>
      </div>
      {showHint ? (
        <div className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500">
          Astuce : choisis un outil, puis clique sur le terrain. Pour les
          flèches, clique-glisse. Sélectionne un objet pour changer sa couleur
          ou son épaisseur sans toucher aux autres.
        </div>
      ) : null}
    </div>
  );
}

function PitchBackground({ pitch }: { pitch: Pitch }) {
  return (
    <image
      href={pitch.src}
      x={0}
      y={0}
      width={pitch.vbW}
      height={pitch.vbH}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

function Toolbar({
  tool,
  setTool,
  canUndo,
  canDelete,
  canClear,
  onUndo,
  onDelete,
  onClear,
  settings,
  showSettings,
  onToggleSettings,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  canUndo: boolean;
  canDelete: boolean;
  canClear: boolean;
  onUndo: () => void;
  onDelete: () => void;
  onClear: () => void;
  settings: SchemaSettings;
  showSettings: boolean;
  onToggleSettings: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 bg-zinc-50 px-1.5 py-1.5">
      <ToolButton active={tool === "select"} onClick={() => setTool("select")} title="Sélection">
        <CursorIcon />
      </ToolButton>
      <Sep />
      <ToolButton active={tool === "home"} onClick={() => setTool("home")} title="Joueur attaquant">
        <PlayerSwatch color={settings.colors.home} label="A" />
      </ToolButton>
      <ToolButton active={tool === "away"} onClick={() => setTool("away")} title="Joueur défenseur">
        <PlayerSwatch color={settings.colors.away} label="D" />
      </ToolButton>
      <ToolButton active={tool === "gk"} onClick={() => setTool("gk")} title="Gardien">
        <PlayerSwatch color={settings.colors.gk} label="G" textColor="#111827" />
      </ToolButton>
      <ToolButton active={tool === "ball"} onClick={() => setTool("ball")} title="Ballon">
        <span
          className="inline-block h-3.5 w-3.5 rounded-full shadow-[0_1px_2px_rgb(0_0_0/0.16)] ring-1 ring-white/90"
          style={{ background: settings.colors.ball }}
        />
      </ToolButton>
      <ToolButton active={tool === "cone"} onClick={() => setTool("cone")} title="Plot / cône">
        <ConeSwatch color={settings.colors.cone} />
      </ToolButton>
      <ToolButton active={tool === "goal-h"} onClick={() => setTool("goal-h")} title="But (horizontal)">
        <GoalSwatch orientation="h" />
      </ToolButton>
      <ToolButton active={tool === "goal-v"} onClick={() => setTool("goal-v")} title="But (vertical)">
        <GoalSwatch orientation="v" />
      </ToolButton>
      <Sep />
      <ToolButton active={tool === "line"} onClick={() => setTool("line")} title="Ligne / zone (clic-glisser)">
        <LineSwatch color={settings.colors.line} />
      </ToolButton>
      <ToolButton active={tool === "arrow-run"} onClick={() => setTool("arrow-run")} title="Course (trait plein)">
        <ArrowSwatch variant="run" color={settings.colors.arrow} />
      </ToolButton>
      <ToolButton active={tool === "arrow-pass"} onClick={() => setTool("arrow-pass")} title="Passe (pointillé)">
        <ArrowSwatch variant="pass" color={settings.colors.arrow} />
      </ToolButton>
      <ToolButton active={tool === "arrow-dribble"} onClick={() => setTool("arrow-dribble")} title="Conduite (vague)">
        <ArrowSwatch variant="wave" color={settings.colors.arrow} />
      </ToolButton>
      <ToolButton active={tool === "arrow-long-ball"} onClick={() => setTool("arrow-long-ball")} title="Longue balle (courbe)">
        <ArrowSwatch variant="curve" color={settings.colors.arrow} />
      </ToolButton>
      <Sep />
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-zinc-700 transition hover:bg-white/80 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35"
        title="Retour"
        aria-label="Retour"
      >
        <UndoArrowIcon />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        className="rounded-md border border-transparent px-1.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-white/80 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35"
        title="Supprimer la sélection"
      >
        Suppr.
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={!canClear}
        className="rounded-md border border-transparent px-1.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-35"
        title="Tout effacer"
      >
        Tout effacer
      </button>
      <button
        type="button"
        onClick={onToggleSettings}
        aria-pressed={showSettings}
        className={`ml-auto flex h-7 w-7 items-center justify-center rounded-md border text-xs font-medium transition ${
          showSettings
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-transparent text-zinc-700 hover:bg-white/80 hover:text-zinc-950"
        }`}
        title="Réglages des symboles"
      >
        <GearIcon />
      </button>
    </div>
  );
}

/* ---------- Selection panel (per-shape colour / thickness override) ---------- */

function withColor(s: SchemaShape, color: string): SchemaShape {
  switch (s.kind) {
    case "player":
    case "ball":
    case "cone":
    case "goal":
    case "line":
    case "arrow":
      return { ...s, color };
  }
}

function withStrokeWidth(s: SchemaShape, strokeWidth: number): SchemaShape {
  if (s.kind === "line" || s.kind === "arrow") {
    return { ...s, strokeWidth };
  }
  return s;
}

function effectiveColor(s: SchemaShape, settings: SchemaSettings): string {
  if (s.kind === "player") {
    if (s.color) return s.color;
    return s.team === "home"
      ? settings.colors.home
      : s.team === "away"
        ? settings.colors.away
        : settings.colors.gk;
  }
  if (s.kind === "ball") return s.color ?? settings.colors.ball;
  if (s.kind === "cone") return s.color ?? settings.colors.cone;
  if (s.kind === "goal") return s.color ?? "#111827";
  if (s.kind === "line") return s.color ?? settings.colors.line;
  return s.color ?? settings.colors.arrow;
}

function effectiveStrokeWidth(
  s: SchemaShape,
  settings: SchemaSettings,
): number | null {
  if (s.kind === "line") return s.strokeWidth ?? settings.lineWidth;
  if (s.kind === "arrow") return s.strokeWidth ?? settings.arrowWidth;
  return null;
}

function shapeKindLabel(s: SchemaShape): string {
  switch (s.kind) {
    case "player":
      return s.team === "home"
        ? "Attaquant"
        : s.team === "away"
          ? "Défenseur"
          : "Gardien";
    case "ball":
      return "Ballon";
    case "cone":
      return "Plot";
    case "goal":
      return "But";
    case "line":
      return "Trait";
    case "arrow":
      return s.style === "run"
        ? "Flèche course"
        : s.style === "pass"
          ? "Flèche passe"
          : s.style === "dribble"
            ? "Flèche conduite"
            : "Flèche longue balle";
  }
}

function SelectionPanel({
  shape,
  settings,
  onColorChange,
  onStrokeChange,
  onReset,
  onClose,
}: {
  shape: SchemaShape;
  settings: SchemaSettings;
  onColorChange: (color: string) => void;
  onStrokeChange: (width: number) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const color = effectiveColor(shape, settings);
  const strokeWidth = effectiveStrokeWidth(shape, settings);
  const hasOverride =
    "color" in shape ||
    (shape.kind === "line" && shape.strokeWidth != null) ||
    (shape.kind === "arrow" && shape.strokeWidth != null);

  return (
    <div className="border-b border-zinc-200 bg-sky-50/60 px-3 py-2 text-xs text-zinc-700">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-zinc-800">
          {shapeKindLabel(shape)} sélectionné
        </span>
        <label className="flex items-center gap-1.5">
          <span className="text-zinc-600">Couleur</span>
          <input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="h-5 w-7 cursor-pointer rounded border border-zinc-200 bg-white p-0"
            aria-label="Couleur de l'élément"
          />
        </label>
        {strokeWidth !== null && (
          <label className="flex flex-1 items-center gap-1.5 sm:max-w-[260px]">
            <span className="whitespace-nowrap text-zinc-600">Épaisseur</span>
            <input
              type="range"
              min={0.2}
              max={3}
              step={0.1}
              value={strokeWidth}
              onChange={(e) => onStrokeChange(parseFloat(e.target.value))}
              className="w-full accent-zinc-900"
            />
            <span className="font-mono text-[11px] text-zinc-500">
              {strokeWidth.toFixed(1)}
            </span>
          </label>
        )}
        <button
          type="button"
          onClick={onReset}
          disabled={!hasOverride}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Revenir aux réglages par défaut pour cet élément"
        >
          Réinitialiser
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100"
          aria-label="Désélectionner"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* ---------- Default-settings panel (per-zone) ---------- */

function SettingsPanel({
  settingsKey,
  settings,
  onChange,
  onClose,
}: {
  settingsKey: SchemaSettingsKey;
  settings: SchemaSettings;
  onChange: (next: SchemaSettings) => void;
  onClose: () => void;
}) {
  function patch(part: Partial<SchemaSettings>) {
    onChange({ ...settings, ...part });
  }
  function patchColor(key: keyof SchemaSettings["colors"], value: string) {
    onChange({ ...settings, colors: { ...settings.colors, [key]: value } });
  }
  return (
    <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-3 text-xs text-zinc-700">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-zinc-800">
          Réglages par défaut — {SETTINGS_LABELS[settingsKey]}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_SCHEMA_SETTINGS)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SliderField
          label="Taille des symboles"
          value={settings.symbolSize}
          min={0.6}
          max={1.6}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => patch({ symbolSize: v })}
        />
        <SliderField
          label="Épaisseur du trait"
          value={settings.lineWidth}
          min={0.2}
          max={2.4}
          step={0.1}
          format={(v) => v.toFixed(1)}
          onChange={(v) => patch({ lineWidth: v })}
        />
        <SliderField
          label="Épaisseur des flèches"
          value={settings.arrowWidth}
          min={0.4}
          max={2.6}
          step={0.1}
          format={(v) => v.toFixed(1)}
          onChange={(v) => patch({ arrowWidth: v })}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ColorField
          label="Attaquant"
          value={settings.colors.home}
          onChange={(v) => patchColor("home", v)}
        />
        <ColorField
          label="Défenseur"
          value={settings.colors.away}
          onChange={(v) => patchColor("away", v)}
        />
        <ColorField
          label="Gardien"
          value={settings.colors.gk}
          onChange={(v) => patchColor("gk", v)}
        />
        <ColorField
          label="Ballon"
          value={settings.colors.ball}
          onChange={(v) => patchColor("ball", v)}
        />
        <ColorField
          label="Plot"
          value={settings.colors.cone}
          onChange={(v) => patchColor("cone", v)}
        />
        <ColorField
          label="Trait"
          value={settings.colors.line}
          onChange={(v) => patchColor("line", v)}
        />
        <ColorField
          label="Flèche"
          value={settings.colors.arrow}
          onChange={(v) => patchColor("arrow", v)}
        />
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-mono text-[11px] text-zinc-500">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-zinc-900"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1">
      <span className="truncate">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-5 w-7 cursor-pointer rounded border border-zinc-200 bg-white p-0"
        aria-label={label}
      />
    </label>
  );
}

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white shadow-[0_1px_2px_rgb(0_0_0/0.16)]"
          : "border-transparent text-zinc-700 hover:bg-white/80 hover:text-zinc-950"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-zinc-200" aria-hidden />;
}

function CursorIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
      <path d="M3 2l7 18 2.5-7.5L20 10z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function UndoArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 7 4 12l5 5" />
      <path d="M20 12H4" />
    </svg>
  );
}

function PlayerSwatch({
  color,
  label,
  textColor = "white",
}: {
  color: string;
  label: string;
  textColor?: string;
}) {
  return (
    <span
      className="flex h-4.5 w-4.5 items-center justify-center rounded-full text-[9px] font-bold shadow-[0_1px_2px_rgb(0_0_0/0.16)] ring-1 ring-white/90"
      style={{ background: color, color: textColor }}
    >
      {label}
    </span>
  );
}

function ConeSwatch({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13">
      <path d="M12 3 L20 20 L4 20 Z" fill={color} stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 3 L20 20 L4 20 Z" fill="none" stroke="#7c2d12" strokeWidth="0.9" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

function GoalSwatch({ orientation }: { orientation: "h" | "v" }) {
  if (orientation === "h") {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14">
        <rect x="3" y="10" width="18" height="5" rx="0.8" fill="#f8fafc" stroke="#334155" strokeWidth="1.4" />
        <line x1="3" y1="9" x2="3" y2="11" stroke="#334155" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="21" y1="9" x2="21" y2="11" stroke="#334155" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="14" height="14">
      <rect x="10" y="3" width="5" height="18" rx="0.8" fill="#f8fafc" stroke="#334155" strokeWidth="1.4" />
      <line x1="9" y1="3" x2="11" y2="3" stroke="#334155" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="9" y1="21" x2="11" y2="21" stroke="#334155" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LineSwatch({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 14" width="19" height="11">
      <line
        x1="3"
        y1="7"
        x2="21"
        y2="7"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowSwatch({
  variant,
  color,
}: {
  variant: "run" | "pass" | "wave" | "curve";
  color: string;
}) {
  const dash = variant === "pass" ? "5 3" : undefined;

  // Path stops just inside the arrow head so the polygon meets the line
  // cleanly — same trick we use in the actual canvas rendering.
  let pathD: string;
  let basePoint: [number, number];
  let tip: [number, number];
  let perp: [number, number];
  if (variant === "wave") {
    pathD = "M2 7 Q5 3 8 7 T14 7";
    basePoint = [14, 7];
    tip = [20, 7];
    perp = [0, 1];
  } else if (variant === "curve") {
    // Quadratic from (2,11) bowing up — split visually before the tip.
    pathD = "M2 11 Q9 -1 16.5 9";
    basePoint = [16.5, 9];
    tip = [20, 11];
    perp = [-2, 3.5]; // perpendicular to the chord (16.5,9)→(20,11)
  } else {
    pathD = "M2 7 L15 7";
    basePoint = [15, 7];
    tip = [20, 7];
    perp = [0, 1];
  }
  const headHalfW = 2.4;
  const plen = Math.hypot(perp[0], perp[1]) || 1;
  const px = (perp[0] / plen) * headHalfW;
  const py = (perp[1] / plen) * headHalfW;

  return (
    <svg viewBox="0 0 24 14" width="19" height="11">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash}
      />
      <polygon
        points={`${tip[0]},${tip[1]} ${basePoint[0] + px},${basePoint[1] + py} ${basePoint[0] - px},${basePoint[1] - py}`}
        fill={color}
      />
    </svg>
  );
}
