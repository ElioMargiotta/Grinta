"use client";

import { useEffect, useRef, useState } from "react";
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

export type PitchKind = "half" | "full-vertical";

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
};

const DEFAULT_PITCH: PitchKind = "half";

const PLAYER_R = 5.2;
const BALL_R = 2.4;
const CONE_R = 3;
const STROKE = 1.2;

type Tool =
  | "select"
  | "home"
  | "away"
  | "gk"
  | "ball"
  | "cone"
  | "arrow-run"
  | "arrow-pass"
  | "arrow-dribble";

function nextId() {
  return `s_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function nextLabel(shapes: SchemaShape[], team: "home" | "away") {
  const n = shapes.filter((s) => s.kind === "player" && s.team === team).length;
  return String(n + 1);
}

/* ----- Read-only renderer (also used by PDF export) ----- */
export function SchemaView({
  data,
  pitch = DEFAULT_PITCH,
}: {
  data: SchemaData;
  pitch?: PitchKind;
}) {
  const p = PITCHES[pitch];
  return (
    <svg
      viewBox={`0 0 ${p.vbW} ${p.vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full"
    >
      <SchemaShapes data={data} />
    </svg>
  );
}

function SchemaShapes({
  data,
  selectedId,
  onShapePointerDown,
  editable = false,
}: {
  data: SchemaData;
  selectedId?: string | null;
  onShapePointerDown?: (s: SchemaShape, e: React.PointerEvent) => void;
  editable?: boolean;
}) {
  return (
    <>
      {data.shapes.map((s) => {
        const selected = !!editable && s.id === selectedId;
        const onDown = (e: React.PointerEvent) =>
          onShapePointerDown?.(s, e);
        const ringStroke = selected ? "#0ea5e9" : "white";
        const ringWidth = selected ? 1.2 : 0.6;

        if (s.kind === "player") {
          const fill =
            s.team === "home"
              ? "#dc2626"
              : s.team === "away"
                ? "#1d4ed8"
                : "#facc15";
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
                r={PLAYER_R}
                fill={fill}
                stroke={ringStroke}
                strokeWidth={ringWidth}
              />
              {s.label && (
                <text
                  x={s.x}
                  y={s.y + PLAYER_R * 0.38}
                  textAnchor="middle"
                  fontSize={PLAYER_R * 1.05}
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
                r={BALL_R}
                fill="#111827"
                stroke={ringStroke}
                strokeWidth={selected ? 0.9 : 0.4}
              />
            </g>
          );
        }
        if (s.kind === "cone") {
          const tri = `M ${s.x} ${s.y - CONE_R} L ${s.x + CONE_R} ${s.y + CONE_R * 0.75} L ${s.x - CONE_R} ${s.y + CONE_R * 0.75} Z`;
          return (
            <path
              key={s.id}
              d={tri}
              fill="#f97316"
              stroke={selected ? "#0ea5e9" : "#7c2d12"}
              strokeWidth={selected ? 0.9 : 0.4}
              strokeLinejoin="round"
              onPointerDown={onDown}
              style={{ cursor: editable ? "pointer" : "default" }}
            />
          );
        }
        // arrow — head drawn as an inline polygon so it survives PDF
        // rasterization (SVG <marker> elements get dropped by some print
        // pipelines or rendered with the wrong color).
        const dasharray =
          s.style === "pass"
            ? `${STROKE * 2.4} ${STROKE * 1.6}`
            : s.style === "dribble"
              ? `${STROKE * 1} ${STROKE * 1.2}`
              : undefined;
        const color = selected ? "#0ea5e9" : "#111827";

        const dx = s.x2 - s.x1;
        const dy = s.y2 - s.y1;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const headLen = STROKE * 3.2;
        const headHalfW = STROKE * 1.6;
        const baseX = s.x2 - headLen * ux;
        const baseY = s.y2 - headLen * uy;
        const c1x = baseX + -uy * headHalfW;
        const c1y = baseY + ux * headHalfW;
        const c2x = baseX - -uy * headHalfW;
        const c2y = baseY - ux * headHalfW;
        // Stop the line just inside the head so dashes don't poke through.
        const lineEndX = baseX + ux * STROKE * 0.5;
        const lineEndY = baseY + uy * STROKE * 0.5;

        return (
          <g
            key={s.id}
            style={{ color, cursor: editable ? "pointer" : "default" }}
            onPointerDown={onDown}
          >
            <line
              x1={s.x1}
              y1={s.y1}
              x2={len > headLen ? lineEndX : s.x2}
              y2={len > headLen ? lineEndY : s.y2}
              stroke="currentColor"
              strokeWidth={STROKE}
              strokeDasharray={dasharray}
              strokeLinecap="round"
            />
            {len > 0.5 && (
              <polygon
                points={`${s.x2},${s.y2} ${c1x},${c1y} ${c2x},${c2y}`}
                fill="currentColor"
                stroke="currentColor"
                strokeWidth={STROKE * 0.4}
                strokeLinejoin="round"
              />
            )}
            {editable && (
              <line
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke="transparent"
                strokeWidth={STROKE * 5}
                strokeLinecap="round"
              />
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
}: {
  value: SchemaData;
  onChange: (next: SchemaData) => void;
  pitch?: PitchKind;
}) {
  const pitchCfg = PITCHES[pitch];
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<SchemaData[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<
    | { kind: "arrow"; id: string }
    | { kind: "shape"; id: string; lastX: number; lastY: number }
    | null
  >(null);

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
    if (
      tool === "arrow-run" ||
      tool === "arrow-pass" ||
      tool === "arrow-dribble"
    ) {
      const style =
        tool === "arrow-run"
          ? "run"
          : tool === "arrow-pass"
            ? "pass"
            : "dribble";
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
    if (drag.kind === "arrow") {
      onChange({
        shapes: value.shapes.map((s) =>
          s.id === drag.id && s.kind === "arrow"
            ? { ...s, x2: p.x, y2: p.y }
            : s,
        ),
      });
    } else {
      const dx = p.x - drag.lastX;
      const dy = p.y - drag.lastY;
      drag.lastX = p.x;
      drag.lastY = p.y;
      onChange({
        shapes: value.shapes.map((s) => {
          if (s.id !== drag.id) return s;
          if (s.kind === "arrow") {
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
    if (drag?.kind === "arrow") {
      const a = value.shapes.find((s) => s.id === drag.id);
      if (a && a.kind === "arrow") {
        const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
        if (len < 10) {
          // discard a 0-length arrow (treat as a stray click)
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
      : tool.startsWith("arrow-")
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
      />
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
            editable
            selectedId={selectedId}
            onShapePointerDown={onShapePointerDown}
          />
        </svg>
      </div>
      <div className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500">
        Astuce : choisis un outil, puis clique sur le terrain. Pour les flèches,
        clique-glisse. Sélectionne (curseur) puis Suppr / Backspace pour
        effacer.
      </div>
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
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  canUndo: boolean;
  canDelete: boolean;
  canClear: boolean;
  onUndo: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 px-2 py-2">
      <ToolButton active={tool === "select"} onClick={() => setTool("select")} title="Sélection">
        <CursorIcon />
      </ToolButton>
      <Sep />
      <ToolButton active={tool === "home"} onClick={() => setTool("home")} title="Joueur attaquant (rouge)">
        <PlayerSwatch color="#dc2626" label="A" />
      </ToolButton>
      <ToolButton active={tool === "away"} onClick={() => setTool("away")} title="Joueur défenseur (bleu)">
        <PlayerSwatch color="#1d4ed8" label="D" />
      </ToolButton>
      <ToolButton active={tool === "gk"} onClick={() => setTool("gk")} title="Gardien">
        <PlayerSwatch color="#facc15" label="G" textColor="#111827" />
      </ToolButton>
      <ToolButton active={tool === "ball"} onClick={() => setTool("ball")} title="Ballon">
        <span className="inline-block h-3 w-3 rounded-full bg-zinc-900" />
      </ToolButton>
      <ToolButton active={tool === "cone"} onClick={() => setTool("cone")} title="Plot / cône">
        <ConeSwatch />
      </ToolButton>
      <Sep />
      <ToolButton active={tool === "arrow-run"} onClick={() => setTool("arrow-run")} title="Course (trait plein)">
        <ArrowSwatch dash="" />
      </ToolButton>
      <ToolButton active={tool === "arrow-pass"} onClick={() => setTool("arrow-pass")} title="Passe (pointillé)">
        <ArrowSwatch dash="6 4" />
      </ToolButton>
      <ToolButton active={tool === "arrow-dribble"} onClick={() => setTool("arrow-dribble")} title="Conduite (tirets serrés)">
        <ArrowSwatch dash="3 3" />
      </ToolButton>
      <Sep />
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        title="Annuler (Cmd/Ctrl+Z bientôt)"
      >
        Annuler
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        title="Supprimer la sélection"
      >
        Suppr.
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={!canClear}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        title="Tout effacer"
      >
        Tout effacer
      </button>
    </div>
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
      className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-6 w-px bg-zinc-200" aria-hidden />;
}

function CursorIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M3 2l7 18 2.5-7.5L20 10z" />
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
      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
      style={{ background: color, color: textColor }}
    >
      {label}
    </span>
  );
}

function ConeSwatch() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14">
      <path d="M12 3 L20 20 L4 20 Z" fill="#f97316" stroke="#7c2d12" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowSwatch({ dash }: { dash: string }) {
  return (
    <svg viewBox="0 0 24 14" width="22" height="12">
      <defs>
        <marker id="swatch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
        </marker>
      </defs>
      <line
        x1="2"
        y1="7"
        x2="20"
        y2="7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dash || undefined}
        markerEnd="url(#swatch-arrow)"
      />
    </svg>
  );
}
