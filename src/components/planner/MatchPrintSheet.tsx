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
export type PrintBench = { jerseyNumber: number | null; name: string; role: string };
export type PrintCallup = {
  jerseyNumber: number | null;
  name: string;
  availability: "available" | "unavailable" | null;
};

export type PrintLabels = {
  formation: string;
  bench: string;
  tactics: string;
  general: string;
  possession: string;
  defense: string;
  transition: string;
  convocation: string;
  present: string;
  absent: string;
  pending: string;
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
  bench,
  tactics,
  callups,
  labels,
}: {
  title: string;
  subtitle: string;
  formation: string;
  starters: PrintStarter[];
  bench: PrintBench[];
  tactics: { general: string; possession: string; defense: string; transition: string };
  callups: PrintCallup[];
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

        {/* Banc + tactique */}
        <div className="flex w-1/2 flex-col gap-3 text-sm">
          {bench.length > 0 ? (
            <div>
              <div className="font-semibold">{labels.bench}</div>
              <ul className="mt-1 space-y-0.5">
                {bench.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-6 text-right tabular-nums text-zinc-500">
                      {b.jerseyNumber ?? "—"}
                    </span>
                    <span>{b.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

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

      {/* Convocation */}
      {callups.length > 0 ? (
        <div className="mt-4">
          <div className="text-sm font-semibold">{labels.convocation}</div>
          <table className="mt-1 w-full border-collapse text-xs">
            <tbody>
              {callups.map((c, i) => (
                <tr key={i} className="border-b border-zinc-200">
                  <td className="w-8 py-0.5 text-right tabular-nums text-zinc-500">
                    {c.jerseyNumber ?? "—"}
                  </td>
                  <td className="py-0.5 pl-2">{c.name}</td>
                  <td className="py-0.5 text-right text-zinc-500">
                    {c.availability === "available"
                      ? labels.present
                      : c.availability === "unavailable"
                        ? labels.absent
                        : labels.pending}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
