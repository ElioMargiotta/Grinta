"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Circle,
  FlagTriangleRight,
  Goal,
  MoveUpRight,
  Spline,
  Trash2,
  Triangle,
  User,
  Users,
} from "lucide-react";
import { FullPitch } from "@/components/sheet/Pitch";
import { Jersey } from "@/components/planner/Jersey";
import { pitchLeftPct, pitchTopPct } from "@/components/planner/match/formations";
import type {
  PhaseArrowKind,
  PhaseBoardValue,
  PhaseToken,
  PhaseTokenKind,
} from "@/lib/planner/tacticalSystems";

const MARGIN_X = (2 / 72) * 100;
const SPAN_X = 68 / 72;
const MARGIN_Y = (2 / 109) * 100;
const SPAN_Y = 105 / 109;

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

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
  const segments = Math.max(3, Math.round(len / 7));
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

/**
 * Éditeur visuel d'une phase arrêtée : jetons (nos joueurs / adversaires / ballon)
 * déplaçables + flèches (course / passe). En lecture seule, sert d'aperçu.
 */
export function PhaseBoard({
  value,
  onChange,
  readOnly = false,
  className,
}: {
  value: PhaseBoardValue;
  onChange?: (next: PhaseBoardValue) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const t = useTranslations("planner.systems.phaseBoard");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const [arrowMode, setArrowMode] = useState(false);
  const [arrowType, setArrowType] = useState<PhaseArrowKind>("run");
  const [tokenTool, setTokenTool] = useState<PhaseTokenKind | null>(null);
  const [draft, setDraft] = useState<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  function toBoard(e: React.PointerEvent): { x: number; y: number } | null {
    const box = boxRef.current;
    if (!box) return null;
    const r = box.getBoundingClientRect();
    const leftPct = ((e.clientX - r.left) / r.width) * 100;
    const topPct = ((e.clientY - r.top) / r.height) * 100;
    return {
      x: Math.max(0, Math.min(100, (leftPct - MARGIN_X) / SPAN_X)),
      y: Math.max(0, Math.min(100, (topPct - MARGIN_Y) / SPAN_Y)),
    };
  }

  function addToken(kind: PhaseTokenKind, pos: { x: number; y: number }) {
    if (!onChange) return;
    const sameCount = value.tokens.filter((tk) => tk.kind === kind).length;
    const label =
      kind === "ball" || kind === "cone" || kind.startsWith("goal")
        ? ""
        : String(sameCount + 1);
    const token: PhaseToken = { id: uid(), kind, x: pos.x, y: pos.y, label };
    onChange({ ...value, tokens: [...value.tokens, token] });
    setSelected(token.id);
  }

  function removeToken(id: string) {
    if (!onChange) return;
    onChange({ ...value, tokens: value.tokens.filter((tk) => tk.id !== id) });
    setSelected(null);
  }

  function removeArrow(id: string) {
    if (!onChange) return;
    onChange({ ...value, arrows: value.arrows.filter((a) => a.id !== id) });
  }

  // ---- Drag des jetons (mode normal) -------------------------------------
  function onTokenDown(id: string, e: React.PointerEvent) {
    if (readOnly || arrowMode) return;
    e.stopPropagation();
    e.preventDefault();
    setTokenTool(null);
    dragRef.current = { id, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function onTokenMove(id: string, e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || d.id !== id || !onChange) return;
    const p = toBoard(e);
    if (!p) return;
    d.moved = true;
    onChange({
      ...value,
      tokens: value.tokens.map((tk) => (tk.id === id ? { ...tk, ...p } : tk)),
    });
  }
  function onTokenUp(id: string) {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && !d.moved) setSelected((s) => (s === id ? null : id));
  }

  // ---- Tracé des flèches (mode flèche) -----------------------------------
  function onBoxDown(e: React.PointerEvent) {
    if (readOnly) return;
    const p = toBoard(e);
    if (!p) return;
    if (tokenTool) {
      addToken(tokenTool, p);
      return;
    }
    if (!arrowMode) {
      setSelected(null);
      return;
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDraft({ fromX: p.x, fromY: p.y, toX: p.x, toY: p.y });
  }
  function onBoxMove(e: React.PointerEvent) {
    if (!draft) return;
    const p = toBoard(e);
    if (!p) return;
    setDraft({ ...draft, toX: p.x, toY: p.y });
  }
  function onBoxUp() {
    if (!draft || !onChange) {
      setDraft(null);
      return;
    }
    const dist = Math.hypot(draft.toX - draft.fromX, draft.toY - draft.fromY);
    if (dist >= 4) {
      onChange({
        ...value,
        arrows: [...value.arrows, { id: uid(), ...draft, kind: arrowType }],
      });
    }
    setDraft(null);
  }

  const arrows = draft
    ? [...value.arrows, { id: "__draft", ...draft, kind: arrowType }]
    : value.arrows;

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolButton onClick={() => { setTokenTool("us"); setArrowMode(false); }} icon={User} label={t("addUs")} active={tokenTool === "us"} />
          <ToolButton onClick={() => { setTokenTool("them"); setArrowMode(false); }} icon={Users} label={t("addThem")} active={tokenTool === "them"} />
          <ToolButton onClick={() => { setTokenTool("gk"); setArrowMode(false); }} icon={FlagTriangleRight} label={t("addGk")} active={tokenTool === "gk"} />
          <ToolButton onClick={() => { setTokenTool("ball"); setArrowMode(false); }} icon={Circle} label={t("addBall")} active={tokenTool === "ball"} />
          <ToolButton onClick={() => { setTokenTool("cone"); setArrowMode(false); }} icon={Triangle} label={t("addCone")} active={tokenTool === "cone"} />
          <ToolButton onClick={() => { setTokenTool("goal-h"); setArrowMode(false); }} icon={Goal} label={t("addGoal")} active={tokenTool === "goal-h"} />
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolButton
            onClick={() => {
              setTokenTool(null);
              setArrowMode((v) => !v);
            }}
            icon={MoveUpRight}
            label={t("arrow")}
            active={arrowMode}
          />
          {arrowMode ? (
            <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
              {(["run", "pass", "dribble", "long-ball"] as PhaseArrowKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setArrowType(k)}
                  className={`inline-flex items-center gap-1 px-2 py-1 font-medium transition ${
                    arrowType === k
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Spline className="h-3 w-3" />
                  {t(`arrowKind.${k}`)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        ref={boxRef}
        onPointerDown={onBoxDown}
        onPointerMove={onBoxMove}
        onPointerUp={onBoxUp}
        onPointerCancel={onBoxUp}
        className={`relative mx-auto w-full max-w-[420px] select-none rounded-lg bg-emerald-700/90 dark:bg-emerald-900/70 ${
          arrowMode || tokenTool ? "cursor-crosshair" : ""
        }`}
        style={{ aspectRatio: "72 / 109", touchAction: "none" }}
      >
        <FullPitch className="absolute inset-0 h-full w-full !text-white/60" />

        {/* Flèches */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <defs>
            <marker
              id="phase-arrowhead"
              markerWidth="5"
              markerHeight="5"
              refX="3.5"
              refY="2.5"
              orient="auto"
            >
              <path d="M0,0 L5,2.5 L0,5 Z" fill="white" />
            </marker>
          </defs>
          {arrows.map((a) => {
            const x1 = pitchLeftPct(a.fromX);
            const y1 = pitchTopPct(a.fromY);
            const x2 = pitchLeftPct(a.toX);
            const y2 = pitchTopPct(a.toY);
            if (a.kind === "dribble") {
              return (
                <path
                  key={a.id}
                  d={buildWavePath(x1, y1, x2, y2, 1.8)}
                  fill="none"
                  stroke="white"
                  strokeWidth={1.4}
                  markerEnd="url(#phase-arrowhead)"
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            return (
              <line
                key={a.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="white"
                strokeWidth={a.kind === "long-ball" ? 1.8 : 1.4}
                strokeDasharray={
                  a.kind === "pass"
                    ? "3 2"
                    : a.kind === "long-ball"
                      ? "8 3"
                      : undefined
                }
                markerEnd="url(#phase-arrowhead)"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* Jetons */}
        {value.tokens.map((tk) => {
          const isSelected = selected === tk.id;
          return (
            <div
              key={tk.id}
              onPointerDown={(e) => onTokenDown(tk.id, e)}
              onPointerMove={(e) => onTokenMove(tk.id, e)}
              onPointerUp={() => onTokenUp(tk.id)}
              onPointerCancel={() => onTokenUp(tk.id)}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${
                readOnly || arrowMode ? "pointer-events-none" : "cursor-grab active:cursor-grabbing"
              }`}
              style={{
                left: `${pitchLeftPct(tk.x)}%`,
                top: `${pitchTopPct(tk.y)}%`,
                width: "16%",
              }}
            >
              <TokenGlyph token={tk} selected={isSelected} />
            </div>
          );
        })}

        {/* Suppression du jeton sélectionné */}
        {!readOnly && selected
          ? (() => {
              const tk = value.tokens.find((x) => x.id === selected);
              if (!tk) return null;
              return (
                <button
                  key="del"
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeToken(tk.id)}
                  className="absolute z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-destructive text-white shadow"
                  style={{
                    left: `calc(${pitchLeftPct(tk.x)}% + 12px)`,
                    top: `calc(${pitchTopPct(tk.y)}% - 14px)`,
                  }}
                  aria-label={t("removeToken")}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              );
            })()
          : null}
      </div>

      {/* Liste des flèches (suppression) */}
      {!readOnly && value.arrows.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.arrows.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onClick={() => removeArrow(a.id)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              {t(`arrowKind.${a.kind}`)} {i + 1}
              <Trash2 className="h-3 w-3" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TokenGlyph({ token, selected }: { token: PhaseToken; selected: boolean }) {
  const ring = selected ? "ring-2 ring-amber-300" : "";
  if (token.kind === "us" || token.kind === "gk") {
    return <Jersey number={token.label || "•"} className={`h-6 w-6 rounded ${ring}`} />;
  }
  if (token.kind === "them") {
    return (
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-bold text-white shadow ring-1 ring-white/80 ${ring}`}
      >
        {token.label || "•"}
      </span>
    );
  }
  if (token.kind === "cone") {
    return (
      <span
        className={`block h-0 w-0 border-x-[6px] border-b-[12px] border-x-transparent border-b-orange-500 drop-shadow ${ring}`}
      />
    );
  }
  if (token.kind === "goal-h" || token.kind === "goal-v") {
    return (
      <span
        className={`block border-2 border-white bg-zinc-900/70 shadow ${
          token.kind === "goal-h" ? "h-2.5 w-7" : "h-7 w-2.5"
        } ${ring}`}
      />
    );
  }
  return (
    <span
      className={`flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] shadow ring-1 ring-zinc-900 ${ring}`}
    >
      ⚽
    </span>
  );
}

function ToolButton({
  onClick,
  icon: Icon,
  label,
  active = false,
}: {
  onClick: () => void;
  icon: typeof User;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
