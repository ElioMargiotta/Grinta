"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PhaseBoard } from "@/components/planner/PhaseBoard";
import type { PhaseBoardValue } from "@/lib/planner/tacticalSystems";

export type TacticBoardKey = "possession" | "defense" | "loss" | "regain";
type TacticTextKey = "objective" | "possession" | "defense" | "loss" | "regain";

const emptyBoard = (): PhaseBoardValue => ({ tokens: [], arrows: [] });

export type TacticsValue = {
  coaches: string;
  matchContext: string;
  structures: string;
  boards: Record<TacticBoardKey, PhaseBoardValue>;
  objective: string;
  general: string;
  possession: string;
  defense: string;
  loss: string;
  regain: string;
  transition: string;
};

const STEPS: {
  key: TacticTextKey;
  kind: "objective" | "possession" | "defense" | "loss" | "regain";
}[] = [
  { key: "objective", kind: "objective" },
  { key: "possession", kind: "possession" },
  { key: "defense", kind: "defense" },
  { key: "loss", kind: "loss" },
  { key: "regain", kind: "regain" },
];

const TEMPLATE: Pick<
  TacticsValue,
  "matchContext" | "structures" | "objective" | "possession" | "defense" | "loss" | "regain"
> = {
  matchContext:
    "Contexte: match de préparation avec un contingent à observer.\nObjectif: donner un cadre clair, voir les comportements et identifier les repères collectifs.",
  structures:
    "Structure principale: 4-2-3-1.\nAlternative: 3-4-3.\nRepère: les rôles de latéraux et pistons changent selon la ligne défensive.",
  objective:
    "Objectif: imposer notre rythme, rester compacts et jouer les temps forts avec lucidité.\nPoints clés: concentration sur les 10 premières minutes, communication constante, réactions immédiates après chaque transition.",
  possession:
    "Sortie: attirer puis trouver le joueur libre.\nProgression: largeur côté ballon, soutien proche, renversement si le couloir est fermé.\nDerniers mètres: attaquer la surface avec au moins 3 joueurs.",
  defense:
    "Bloc: distances courtes entre les lignes.\nPressing: orienter vers l'extérieur et fermer l'axe.\nDuel: agressivité contrôlée, couverture immédiate du partenaire qui sort.",
  loss:
    "5 secondes: contre-pressing immédiat autour du ballon.\nSi le pressing est battu: repli sprint vers l'axe, protéger la profondeur.\nFaute utile uniquement loin de notre but.",
  regain:
    "Premier regard vers l'avant.\nSi l'adversaire est désorganisé: jouer vite dans la profondeur.\nSi rien n'est ouvert: sécuriser, ressortir et installer notre possession.",
};

const DETECTION_TEMPLATE: Pick<
  TacticsValue,
  "matchContext" | "structures" | "objective" | "possession" | "defense" | "regain" | "loss"
> = {
  matchContext:
    "Match amical de fin de saison.\nNouveau contingent, détection et tests finaux.\nPriorité: observer les comportements dans un cadre simple, clair et commun.",
  structures:
    "Deux blocs possibles: 4-2-3-1 et 3-4-3.\nAttention aux latéraux / pistons: rôle différent à 4 défenseurs et à 3 défenseurs.\nLe cadre reste prioritaire: permutations possibles, mais on garde l'équilibre des positions.",
  objective:
    "Objectif du match: évaluer les joueurs dans les principes de base.\nOn cherche la disponibilité, la compréhension des espaces, la discipline collective et les réactions aux transitions.",
  possession:
    "Nous n'avons pas eu l'occasion de beaucoup travailler: on se concentre sur les bases.\nJe donne, je redemande: se mettre dans le champ de vision, se rendre disponible.\nCréer des triangles de jeu.\nRespecter les positions; permutations possibles si le cadre reste équilibré.\nQuand un côté est bloqué, on ressort et on va de l'autre côté.",
  defense:
    "Bloc médian: il fait chaud, donc pas de pression constante.\nBloc compact, distances courtes entre les lignes.\nOn attire l'adversaire sur un côté, puis on déclenche le pressing quand il est isolé.\nAttention à la gestion de la profondeur et aux couvertures.",
  regain:
    "À la récupération:\nZone 2-3: vite vers l'avant si l'espace est ouvert.\nZone 2-1: on sécurise la possession, on ressort proprement et on garde le ballon.",
  loss:
    "À la perte:\nSi infériorité numérique: ralentir l'action, protéger son but, rester compact.\nSi supériorité autour du ballon: contre-pressing 6-8 secondes pour récupérer rapidement.",
};

export function MatchTactics({
  value,
  onChange,
}: {
  value: TacticsValue;
  onChange: (next: TacticsValue) => void;
}) {
  const t = useTranslations("planner.match.prematch.tactics");
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const currentBoardKey =
    current.kind === "objective" ? null : (current.kind as TacticBoardKey);
  const filled = useMemo(
    () => STEPS.filter((s) => value[s.key].trim()).length,
    [value],
  );

  function patch(key: keyof TacticsValue, text: string) {
    const next = { ...value, [key]: text };
    if (key === "objective") next.general = text;
    if (key === "loss") next.transition = text;
    onChange(next);
  }

  function applyTemplate() {
    onChange({
      ...value,
      matchContext: value.matchContext || TEMPLATE.matchContext,
      structures: value.structures || TEMPLATE.structures,
      boards: value.boards,
      objective: value.objective || TEMPLATE.objective,
      general: value.general || TEMPLATE.objective,
      possession: value.possession || TEMPLATE.possession,
      defense: value.defense || TEMPLATE.defense,
      loss: value.loss || TEMPLATE.loss,
      regain: value.regain || TEMPLATE.regain,
      transition: value.transition || TEMPLATE.loss,
    });
  }

  function applyDetectionTemplate() {
    onChange({
      ...value,
      matchContext: DETECTION_TEMPLATE.matchContext,
      structures: DETECTION_TEMPLATE.structures,
      boards: value.boards,
      objective: DETECTION_TEMPLATE.objective,
      general: DETECTION_TEMPLATE.objective,
      possession: DETECTION_TEMPLATE.possession,
      defense: DETECTION_TEMPLATE.defense,
      loss: DETECTION_TEMPLATE.loss,
      regain: DETECTION_TEMPLATE.regain,
      transition: DETECTION_TEMPLATE.loss,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="tactics-context"
            className="text-sm font-medium text-foreground"
          >
            {t("matchContext")}
          </label>
          <textarea
            id="tactics-context"
            rows={4}
            value={value.matchContext}
            onChange={(e) => onChange({ ...value, matchContext: e.target.value })}
            placeholder={t("matchContextPlaceholder")}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="tactics-structures"
            className="text-sm font-medium text-foreground"
          >
            {t("structures")}
          </label>
          <textarea
            id="tactics-structures"
            rows={4}
            value={value.structures}
            onChange={(e) => onChange({ ...value, structures: e.target.value })}
            placeholder={t("structuresPlaceholder")}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="tactics-coaches"
          className="text-sm font-medium text-foreground"
        >
          {t("coaches")}
        </label>
        <textarea
          id="tactics-coaches"
          rows={3}
          value={value.coaches}
          onChange={(e) => onChange({ ...value, coaches: e.target.value })}
          placeholder={t("coachesPlaceholder")}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStep(i)}
            className={`inline-flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm font-medium transition ${
              step === i
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            <span className="tabular-nums">{i + 1}</span>
            <span>{t(s.key)}</span>
          </button>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={applyTemplate}>
          <ClipboardList className="h-3.5 w-3.5" />
          {t("template")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={applyDetectionTemplate}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          {t("detectionTemplate")}
        </Button>
        <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
          {filled}/{STEPS.length}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`tactics-${current.key}`}
            className="text-sm font-medium text-foreground"
          >
            {t(current.key)}
          </label>
          <textarea
            id={`tactics-${current.key}`}
            rows={10}
            value={value[current.key]}
            onChange={(e) => patch(current.key, e.target.value)}
            placeholder={t(`${current.key}Placeholder`)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
          />
        </div>
        {currentBoardKey ? (
          <PhaseBoard
            value={value.boards[currentBoardKey] ?? emptyBoard()}
            onChange={(board) =>
              onChange({
                ...value,
                boards: { ...value.boards, [currentBoardKey]: board },
              })
            }
          />
        ) : (
          <TacticSketch kind={current.kind} />
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("previous")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          disabled={step === STEPS.length - 1}
        >
          {t("next")}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function TacticSketch({
  kind,
  className,
}: {
  kind: "objective" | "possession" | "defense" | "loss" | "regain";
  className?: string;
}) {
  type SketchArrow = [number, number, number, number, boolean];
  const us =
    kind === "defense"
      ? [
          [36, 64],
          [50, 64],
          [64, 64],
          [42, 50],
          [58, 50],
          [50, 37],
        ]
      : [
          [35, 70],
          [50, 62],
          [65, 70],
          [30, 48],
          [50, 42],
          [70, 48],
        ];
  const them = [
    [36, 31],
    [50, 26],
    [64, 31],
    [44, 42],
    [56, 42],
  ];
  const arrows: SketchArrow[] =
    kind === "possession"
      ? [
          [35, 70, 50, 62, false],
          [50, 62, 70, 48, true],
          [70, 48, 58, 25, false],
        ]
      : kind === "defense"
        ? [
            [36, 64, 44, 42, false],
            [64, 64, 56, 42, false],
            [50, 37, 50, 26, false],
          ]
        : kind === "loss"
          ? [
              [50, 42, 50, 34, false],
              [30, 48, 42, 40, false],
              [70, 48, 58, 40, false],
            ]
          : kind === "regain"
            ? [
                [50, 42, 50, 25, true],
                [35, 70, 30, 48, false],
                [65, 70, 70, 48, false],
              ]
            : [
                [35, 70, 50, 62, false],
                [50, 62, 65, 70, false],
                [50, 42, 50, 26, true],
              ];

  return (
    <div
      className={`relative mx-auto w-full max-w-[280px] overflow-hidden rounded-lg bg-emerald-700 ${className ?? ""}`}
      style={{ aspectRatio: "72 / 109" }}
      aria-hidden="true"
    >
      <div className="absolute inset-[3%] rounded border border-white/45" />
      <div className="absolute left-[18%] right-[18%] top-[3%] h-[15%] border border-t-0 border-white/35" />
      <div className="absolute bottom-[3%] left-[18%] right-[18%] h-[15%] border border-b-0 border-white/35" />
      <div className="absolute left-[8%] right-[8%] top-1/2 border-t border-white/35" />
      <div className="absolute left-1/2 top-1/2 h-[18%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <defs>
          <marker id={`tactic-head-${kind}`} markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="white" />
          </marker>
        </defs>
        {arrows.map(([x1, y1, x2, y2, dash], i) => (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="white"
            strokeWidth="1.6"
            strokeDasharray={dash ? "4 3" : undefined}
            markerEnd={`url(#tactic-head-${kind})`}
          />
        ))}
      </svg>
      {them.map(([x, y], i) => (
        <span
          key={`t-${i}`}
          className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-950 text-[10px] font-bold text-white ring-1 ring-white"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          {i + 1}
        </span>
      ))}
      {us.map(([x, y], i) => (
        <span
          key={`u-${i}`}
          className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded bg-white text-[10px] font-bold text-emerald-900 shadow"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          {i + 1}
        </span>
      ))}
      <span className="absolute left-1/2 top-[42%] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-1 ring-zinc-900" />
    </div>
  );
}
