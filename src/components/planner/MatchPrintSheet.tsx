"use client";

import type { ReactNode } from "react";
import { FullPitch } from "@/components/sheet/Pitch";
import { PhaseBoard } from "@/components/planner/PhaseBoard";
import { TacticSketch } from "@/components/planner/MatchTactics";
import { pitchLeftPct, pitchTopPct } from "@/components/planner/match/formations";
import type { MatchPhase } from "@/components/planner/MatchPhases";
import type { PhaseBoardValue } from "@/lib/planner/tacticalSystems";

export type PrintStarter = {
  jerseyNumber: number | null;
  name: string;
  role: string;
  x: number;
  y: number;
};
export type PrintMember = {
  jerseyNumber: number | null;
  name: string;
  role?: string;
  reason?: string;
};
export type PrintGroup = { label: string; players: PrintMember[] };

export type PrintLabels = {
  formation: string;
  tactics: string;
  matchContext: string;
  structures: string;
  objective: string;
  general: string;
  possession: string;
  defense: string;
  loss: string;
  regain: string;
  transition: string;
  squad: string;
  starters: string;
  setPieces: string;
  reason: string;
  coach: string;
};

/**
 * Feuille imprimable de la compo + convocation. Visible uniquement à l'impression
 * (classe `.prep-export`, cf. globals.css), masquée à l'écran.
 */
export function MatchPrintSheet({
  title,
  subtitle,
  formation,
  starters,
  groups,
  tactics,
  phases,
  labels,
  includeSquadPage = true,
  clubLogos = [],
}: {
  title: string;
  subtitle: string;
  formation: string;
  starters: PrintStarter[];
  groups: PrintGroup[];
  tactics: {
    coaches: string;
    matchContext: string;
    structures: string;
    boards: Record<"possession" | "defense" | "loss" | "regain", PhaseBoardValue>;
    objective: string;
    general: string;
    possession: string;
    defense: string;
    loss: string;
    regain: string;
    transition: string;
  };
  phases: MatchPhase[];
  labels: PrintLabels;
  includeSquadPage?: boolean;
  clubLogos?: string[];
}) {
  const tacticEntries = (
    [
      ["objective", tactics.objective || tactics.general],
      ["possession", tactics.possession],
      ["defense", tactics.defense],
      ["loss", tactics.loss || tactics.transition],
      ["regain", tactics.regain],
    ] as const
  ).filter(([, v]) => v.trim());
  const summaryEntries = (
    [
      ["possession", tactics.possession],
      ["defense", tactics.defense],
      ["regain", tactics.regain],
      ["loss", tactics.loss || tactics.transition],
    ] as const
  ).filter(([, v]) => v.trim());
  const substitutes = groups[0]?.players ?? [];
  const formationParts = splitFormationLabel(formation);
  const coachLines = formatCoachLines(tactics.coaches);

  return (
    <div className="prep-export hidden bg-white text-zinc-900 print:block">
      <section className="prep-page bg-white">
        <div className="mx-auto flex h-full w-[184mm] flex-col py-[12mm]">
          <div className="mb-[8mm] grid h-[30mm] grid-cols-[1fr_42mm_22mm] items-start gap-[6mm]">
            <div className="min-w-0 pt-[1mm]">
              <h1 className="truncate text-[28px] font-black uppercase leading-none tracking-normal text-zinc-900">
              {title}
              </h1>
              <p className="mt-[4mm] w-fit border-l-[3mm] border-zinc-900 pl-[3mm] text-[10px] font-semibold uppercase leading-none tracking-normal text-zinc-500">
                {subtitle}
              </p>
            </div>
            <div className="h-[24mm] bg-zinc-100 px-[5mm] py-[4mm]">
              <div className="text-[9px] font-bold uppercase leading-none text-zinc-500">
                {labels.formation}
              </div>
              <div className="mt-[2mm] flex flex-col gap-[1mm] leading-none text-zinc-900">
                <span className="truncate whitespace-nowrap text-[18px] font-black tabular-nums">
                  {formationParts.main}
                </span>
                {formationParts.detail ? (
                  <span className="truncate whitespace-nowrap text-[10px] font-bold">
                    {formationParts.detail}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex h-[22mm] w-[22mm] items-center justify-center gap-[1mm] bg-white">
              {clubLogos.length > 0 ? (
                clubLogos.slice(0, 3).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${url}-${i}`}
                    src={url}
                    alt=""
                    className="max-h-full min-w-0 flex-1 object-contain"
                  />
                ))
              ) : (
                <span className="text-center text-[7px] font-black uppercase leading-tight text-zinc-500">
                  Logo
                </span>
              )}
            </div>
          </div>

          <div className="grid flex-1 grid-cols-[120mm_56mm] items-start gap-[8mm]">
            <div className="flex min-w-0 flex-col items-center">
              <div className="relative h-[178mm] w-[118mm] bg-white">
                <FullPitch className="absolute inset-[8mm] h-[162mm] w-[102mm] translate-x-[1mm] !text-zinc-900/75" />
                {starters.map((s, i) => (
                  <div
                    key={i}
                    className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                    style={{
                      left: `${pitchLeftPct(s.x)}%`,
                      top: `${pitchTopPct(s.y)}%`,
                      width: "25mm",
                    }}
                  >
                    <PrintJersey number={s.jerseyNumber ?? i + 1} />
                    <span className="mt-[1mm] max-w-[25mm] truncate bg-white/95 px-[1.5mm] py-[0.5mm] text-[7px] font-bold uppercase leading-none text-zinc-900 ring-1 ring-zinc-300">
                      {s.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-[5mm] w-[118mm] border border-zinc-900">
                <div className="bg-zinc-900 px-[3mm] py-[1.5mm] text-center text-[10px] font-black uppercase leading-none tracking-normal text-white">
                  {substitutes.length > 0 ? groups[0]?.label : labels.squad}
                </div>
                {substitutes.length > 0 ? (
                  <div className="grid min-h-[18mm] grid-cols-2 gap-x-[5mm] gap-y-[1.5mm] p-[3mm] text-[8px]">
                    {substitutes.map((p, i) => (
                      <div key={`${p.name}-${i}`} className="flex min-w-0 gap-[1.5mm]">
                        <span className="w-[7mm] shrink-0 text-right font-black tabular-nums">
                          {p.jerseyNumber ?? "-"}.
                        </span>
                        <span className="truncate font-semibold uppercase">
                          {p.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[16mm]" />
                )}
              </div>
            </div>

            <aside className="w-[56mm] pt-[3mm]">
              <div className="border border-zinc-900">
                <div className="bg-zinc-900 px-[3mm] py-[2mm] text-center text-[12px] font-black uppercase leading-none tracking-normal text-white">
                  {labels.starters}
                </div>
                <ol className="divide-y divide-zinc-200 px-[3mm] py-[2mm] text-[9px]">
                  {starters.map((s, i) => (
                    <li
                      key={`${s.name}-${i}`}
                      className="flex min-w-0 gap-[2mm] py-[1.5mm]"
                    >
                      <span className="w-[7mm] shrink-0 text-right font-black tabular-nums">
                        {s.jerseyNumber ?? i + 1}.
                      </span>
                      <span className="min-w-0 flex-1 truncate font-bold uppercase">
                        {s.name}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="mt-[5mm] border border-zinc-900">
                <div className="bg-[var(--club-primary)] px-[3mm] py-[2mm] text-center text-[12px] font-black uppercase leading-none tracking-normal text-white">
                  {labels.coach}
                </div>
                <div className="flex min-h-[22mm] items-center px-[4mm] py-[3mm] text-[10px] font-bold uppercase leading-snug text-zinc-900">
                  <span className="whitespace-pre-wrap">{coachLines}</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {includeSquadPage ? (
        <PrintPage title={title} subtitle={subtitle}>
          <div className="mb-3 text-lg font-bold">{labels.squad}</div>
          <div className="grid grid-cols-2 gap-4">
            <PrintGroupBlock
              group={{
                label: labels.starters,
                players: starters.map((s) => ({
                  jerseyNumber: s.jerseyNumber,
                  name: s.name,
                  role: s.role,
                })),
              }}
              showReason={false}
            />
            {groups.map((g) => (
              <PrintGroupBlock
                key={g.label}
                group={g}
                showReason={g.players.some((p) => p.reason)}
                reasonLabel={labels.reason}
              />
            ))}
          </div>
        </PrintPage>
      ) : null}

      {tacticEntries.length > 0 || tactics.matchContext.trim() || tactics.structures.trim() ? (
        <section className="prep-page bg-white">
          <div className="mx-auto flex h-full w-[184mm] flex-col py-[12mm]">
            <div className="mb-[6mm] flex items-start justify-between gap-[8mm] border-b-2 border-zinc-900 pb-[4mm]">
              <div className="min-w-0">
                <h1 className="truncate text-[24px] font-black uppercase leading-none tracking-normal text-zinc-900">
                  {labels.tactics}
                </h1>
                <p className="mt-[2mm] truncate text-[10px] font-semibold uppercase text-zinc-500">
                  {title} · {subtitle}
                </p>
              </div>
              <div className="shrink-0 bg-[var(--club-primary)] px-[5mm] py-[2mm] text-[11px] font-black uppercase text-white">
                {labels.objective}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[4mm]">
              <TacticalInfoBlock
                label={labels.matchContext}
                value={tactics.matchContext || tactics.objective || tactics.general}
              />
              <TacticalInfoBlock
                label={labels.structures}
                value={tactics.structures}
              />
            </div>

            <div className="mt-[5mm] grid flex-1 grid-cols-2 gap-[4mm]">
              {summaryEntries.map(([key, val]) => (
                <div
                  key={key}
                  className="grid min-h-0 grid-cols-[30mm_1fr] gap-[3mm] border border-zinc-300 p-[3mm]"
                >
                  {tactics.boards[key]?.tokens.length ||
                  tactics.boards[key]?.arrows.length ? (
                    <div className="h-[36mm] w-[26mm] overflow-hidden">
                      <PhaseBoard
                        value={tactics.boards[key]}
                        readOnly
                        className="scale-[0.58] origin-top"
                      />
                    </div>
                  ) : (
                    <TacticSketch
                      kind={key}
                      className="max-w-none self-start rounded-none"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="mb-[2mm] border-b border-zinc-300 pb-[1mm] text-[11px] font-black uppercase leading-none text-zinc-900">
                      {labels[key]}
                    </div>
                    <p className="whitespace-pre-wrap text-[8.5px] font-medium leading-snug text-zinc-800">
                      {val}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {phases.length > 0 ? (
        <PrintPage title={title} subtitle={subtitle}>
          <div className="mb-3 text-lg font-bold">{labels.setPieces}</div>
          <div className="grid grid-cols-2 gap-5">
            {phases.map((p) => (
              <div key={p.id} className="break-inside-avoid">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="text-sm font-bold">
                    {p.name || p.systemName}
                  </div>
                  <div className="text-[10px] font-medium uppercase text-zinc-500">
                    {p.systemName}
                  </div>
                </div>
                <PhaseBoard value={p.board} readOnly className="print-phase-board" />
              </div>
            ))}
          </div>
        </PrintPage>
      ) : null}
    </div>
  );
}

function splitFormationLabel(label: string): { main: string; detail: string | null } {
  const match = label.match(/^(.*?)\s*(\([^()]*\))\s*$/);
  if (!match) return { main: label, detail: null };
  return { main: match[1].trim(), detail: match[2] };
}

function formatCoachLines(value: string): string {
  return value
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function PrintJersey({ number }: { number: number | string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className="h-[11mm] w-[11mm] drop-shadow-sm"
      aria-hidden="true"
    >
      <path
        d="M13 4 L6 8 L3 15 L8 18 L11 16 L11 36 L29 36 L29 16 L32 18 L37 15 L34 8 L27 4 C27 9 13 9 13 4 Z"
        fill="var(--club-primary)"
        stroke="white"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M13 4 C13 9 27 9 27 4"
        fill="none"
        stroke="rgba(255,255,255,.65)"
        strokeWidth="1.4"
      />
      <text
        x="20"
        y="28"
        textAnchor="middle"
        fontSize="14"
        fontWeight="900"
        fill="white"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {number}
      </text>
    </svg>
  );
}

function PrintPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="prep-page bg-white p-6">
      <div className="mb-4 border-b border-zinc-300 pb-2">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-zinc-600">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function TacticalInfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[28mm] border border-zinc-900">
      <div className="bg-zinc-900 px-[3mm] py-[1.5mm] text-[10px] font-black uppercase leading-none text-white">
        {label}
      </div>
      <p className="whitespace-pre-wrap px-[3mm] py-[2mm] text-[8.5px] font-medium leading-snug text-zinc-800">
        {value}
      </p>
    </div>
  );
}

function PrintGroupBlock({
  group,
  showReason,
  reasonLabel,
}: {
  group: PrintGroup;
  showReason: boolean;
  reasonLabel?: string;
}) {
  if (group.players.length === 0) return null;
  return (
    <div className="break-inside-avoid rounded border border-zinc-300 p-3">
      <div className="mb-2 text-sm font-bold">{group.label}</div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[10px] uppercase text-zinc-500">
            <th className="w-8 py-1 text-right">#</th>
            <th className="px-2 py-1">Nom</th>
            {showReason ? <th className="py-1">{reasonLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {group.players.map((p, i) => (
            <tr key={`${p.name}-${i}`} className="border-b border-zinc-100">
              <td className="py-1 text-right font-semibold tabular-nums text-zinc-600">
                {p.jerseyNumber ?? "-"}
              </td>
              <td className="px-2 py-1">
                <span className="font-medium">{p.name}</span>
                {p.role ? (
                  <span className="ml-1 text-[10px] uppercase text-zinc-500">
                    {p.role}
                  </span>
                ) : null}
              </td>
              {showReason ? (
                <td className="py-1 text-zinc-600">{p.reason ?? ""}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
