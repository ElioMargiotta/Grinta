"use client";

import { FullPitch } from "@/components/sheet/Pitch";
import { pitchLeftPct, pitchTopPct } from "@/components/planner/match/formations";

export type PrintStarter = {
  jerseyNumber: number | null;
  name: string;
  role: string;
  x: number;
  y: number;
};
export type PrintMember = { jerseyNumber: number | null; name: string };
export type PrintGroup = { label: string; players: PrintMember[] };

export type PrintLabels = {
  formation: string;
  tactics: string;
  general: string;
  possession: string;
  defense: string;
  transition: string;
  squad: string;
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
  labels,
}: {
  title: string;
  subtitle: string;
  formation: string;
  starters: PrintStarter[];
  groups: PrintGroup[];
  tactics: { general: string; possession: string; defense: string; transition: string };
  labels: PrintLabels;
}) {
  const tacticEntries = (
    [
      ["general", tactics.general],
      ["possession", tactics.possession],
      ["defense", tactics.defense],
      ["transition", tactics.transition],
    ] as const
  ).filter(([, v]) => v.trim());

  return (
    <div className="prep-export hidden bg-white p-6 text-zinc-900 print:block">
      <div className="mb-3 border-b border-zinc-300 pb-2">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-zinc-600">{subtitle}</p>
      </div>

      <div className="flex gap-6">
        {/* Terrain */}
        <div className="w-1/2">
          <div className="mb-1 text-sm font-semibold">
            {labels.formation}: {formation}
          </div>
          <div
            className="relative w-full rounded bg-emerald-700"
            style={{ aspectRatio: "72 / 109" }}
          >
            <FullPitch className="absolute inset-0 h-full w-full !text-white/70" />
            {starters.map((s, i) => (
              <div
                key={i}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{
                  left: `${pitchLeftPct(s.x)}%`,
                  top: `${pitchTopPct(s.y)}%`,
                  width: "22%",
                }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-bold tabular-nums text-emerald-900 ring-1 ring-emerald-900">
                  {s.jerseyNumber ?? "—"}
                </span>
                <span className="mt-0.5 max-w-full truncate rounded bg-black/50 px-1 text-[8px] font-medium text-white">
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Consignes tactiques */}
        <div className="flex w-1/2 flex-col gap-3 text-sm">
          {tacticEntries.length > 0 ? (
            <div>
              <div className="font-semibold">{labels.tactics}</div>
              <dl className="mt-1 space-y-1">
                {tacticEntries.map(([key, val]) => (
                  <div key={key}>
                    <dt className="text-xs font-medium text-zinc-500">
                      {labels[key]}
                    </dt>
                    <dd className="whitespace-pre-wrap">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>

      {/* Convocation — groupes (remplaçants, non convoqués, indispos) */}
      {groups.length > 0 ? (
        <div className="mt-4">
          <div className="text-sm font-semibold">{labels.squad}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-2">
            {groups.map((g) => (
              <div key={g.label} className="break-inside-avoid">
                <div className="text-xs font-semibold text-zinc-600">
                  {g.label}
                </div>
                <ul className="mt-0.5 space-y-0.5 text-xs">
                  {g.players.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-6 text-right tabular-nums text-zinc-500">
                        {p.jerseyNumber ?? "—"}
                      </span>
                      <span>{p.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
