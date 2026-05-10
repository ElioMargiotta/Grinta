"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  FileDown,
  GripVertical,
  Library,
  PencilRuler,
  Trash2,
} from "lucide-react";
import { SchemaView } from "@/components/sheet/SchemaEditor";
import type { SchemaData } from "@/components/sheet/types";

type Family = "PE" | "TE" | "TA" | "AT";

type Block = {
  id: string;
  dur: number;
  name: string;
  family: Family;
  desc: string;
  source: "lib" | "schema";
  schema: SchemaData;
};

// ── Sample schemas built with the real shape model ───────────────────────
const SCHEMA_RONDO: SchemaData = {
  shapes: [
    { id: "p1", kind: "player", team: "home", label: "1", x: 35, y: 35 },
    { id: "p2", kind: "player", team: "home", label: "2", x: 95, y: 30 },
    { id: "p3", kind: "player", team: "home", label: "3", x: 110, y: 70 },
    { id: "p4", kind: "player", team: "home", label: "4", x: 50, y: 78 },
    { id: "p5", kind: "player", team: "away", x: 65, y: 50 },
    { id: "p6", kind: "player", team: "away", x: 90, y: 60 },
    { id: "b1", kind: "ball", x: 35, y: 35 },
    { id: "a1", kind: "arrow", style: "pass", x1: 35, y1: 35, x2: 95, y2: 30 },
    { id: "a2", kind: "arrow", style: "pass", x1: 95, y1: 30, x2: 110, y2: 70 },
  ],
};

const SCHEMA_PRESSING: SchemaData = {
  shapes: [
    { id: "h1", kind: "player", team: "home", label: "9", x: 70, y: 25 },
    { id: "h2", kind: "player", team: "home", label: "10", x: 50, y: 40 },
    { id: "h3", kind: "player", team: "home", label: "8", x: 90, y: 40 },
    { id: "a1", kind: "player", team: "away", label: "6", x: 70, y: 55 },
    { id: "a2", kind: "player", team: "away", label: "4", x: 35, y: 70 },
    { id: "a3", kind: "player", team: "away", label: "5", x: 105, y: 70 },
    { id: "ar1", kind: "arrow", style: "run", x1: 70, y1: 25, x2: 70, y2: 50 },
    { id: "ar2", kind: "arrow", style: "run", x1: 50, y1: 40, x2: 60, y2: 55 },
    { id: "ar3", kind: "arrow", style: "run", x1: 90, y1: 40, x2: 80, y2: 55 },
  ],
};

const SCHEMA_BLOC: SchemaData = {
  shapes: [
    { id: "h1", kind: "player", team: "home", label: "6", x: 35, y: 60 },
    { id: "h2", kind: "player", team: "home", label: "8", x: 70, y: 55 },
    { id: "h3", kind: "player", team: "home", label: "10", x: 105, y: 60 },
    { id: "h4", kind: "player", team: "home", label: "11", x: 50, y: 30 },
    { id: "h5", kind: "player", team: "home", label: "7", x: 95, y: 30 },
    { id: "a1", kind: "player", team: "away", x: 70, y: 80 },
    { id: "a2", kind: "player", team: "away", x: 40, y: 90 },
    { id: "a3", kind: "player", team: "away", x: 100, y: 90 },
    { id: "b1", kind: "ball", x: 70, y: 55 },
    { id: "ap1", kind: "arrow", style: "pass", x1: 70, y1: 55, x2: 50, y2: 30 },
    { id: "ap2", kind: "arrow", style: "long-ball", x1: 50, y1: 30, x2: 95, y2: 30 },
  ],
};

const SCHEMA_WARMUP: SchemaData = {
  shapes: [
    { id: "c1", kind: "cone", x: 30, y: 30 },
    { id: "c2", kind: "cone", x: 60, y: 30 },
    { id: "c3", kind: "cone", x: 90, y: 30 },
    { id: "c4", kind: "cone", x: 120, y: 30 },
    { id: "c5", kind: "cone", x: 30, y: 75 },
    { id: "c6", kind: "cone", x: 60, y: 75 },
    { id: "c7", kind: "cone", x: 90, y: 75 },
    { id: "c8", kind: "cone", x: 120, y: 75 },
    { id: "p1", kind: "player", team: "home", x: 25, y: 52 },
    { id: "ar", kind: "arrow", style: "run", x1: 25, y1: 52, x2: 130, y2: 52 },
  ],
};

const SCHEMA_GAME: SchemaData = {
  shapes: [
    { id: "h1", kind: "player", team: "home", label: "1", x: 40, y: 40 },
    { id: "h2", kind: "player", team: "home", label: "2", x: 75, y: 30 },
    { id: "h3", kind: "player", team: "home", label: "3", x: 75, y: 70 },
    { id: "h4", kind: "player", team: "home", label: "4", x: 110, y: 50 },
    { id: "a1", kind: "player", team: "away", label: "1", x: 60, y: 50 },
    { id: "a2", kind: "player", team: "away", label: "2", x: 95, y: 40 },
    { id: "a3", kind: "player", team: "away", label: "3", x: 95, y: 70 },
    { id: "j1", kind: "player", team: "gk", label: "J", x: 25, y: 52 },
    { id: "j2", kind: "player", team: "gk", label: "J", x: 130, y: 52 },
    { id: "b1", kind: "ball", x: 40, y: 40 },
  ],
};

const FAMILY_COLOR: Record<Family, string> = {
  PE: "#c94a4a",
  TE: "#2d8f5f",
  TA: "#2f5fba",
  AT: "#7a5bb8",
};
const INITIAL_BLOCKS: Block[] = [
  {
    id: "b1",
    dur: 15,
    name: "Activation neuromusculaire",
    family: "PE",
    desc: "Skipping, talons-fesses, pas chassés. 2×30s par appui.",
    source: "lib",
    schema: SCHEMA_WARMUP,
  },
  {
    id: "b2",
    dur: 18,
    name: "Conservation 4v2 + appui",
    family: "TE",
    desc: "Carré 20×20m. 3 séries × 4'. 90s de récup.",
    source: "schema",
    schema: SCHEMA_RONDO,
  },
  {
    id: "b3",
    dur: 22,
    name: "Bloc médian — sortie axe",
    family: "TA",
    desc: "10v8 sur demi-terrain. Déclencheurs de pressing à mi-terrain.",
    source: "lib",
    schema: SCHEMA_BLOC,
  },
];

const LIB_PICKS: Omit<Block, "id">[] = [
  {
    dur: 15,
    name: "Jeu réduit 4v4 + 2 jokers",
    family: "TA",
    desc: "Terrain 30×40m. 4 séries × 3'. 1' récup.",
    source: "lib",
    schema: SCHEMA_GAME,
  },
  {
    dur: 12,
    name: "Rondo 5v2 + appui",
    family: "TE",
    desc: "10×10m. Une touche pour les appuis, libre au centre.",
    source: "lib",
    schema: SCHEMA_RONDO,
  },
  {
    dur: 10,
    name: "Décrassage + retour au calme",
    family: "PE",
    desc: "Footing souple 5', mobilité hanches & ischios 5'.",
    source: "lib",
    schema: SCHEMA_WARMUP,
  },
];
const SCHEMA_PICKS: Omit<Block, "id">[] = [
  {
    dur: 18,
    name: "Pressing — déclencheurs axe",
    family: "TA",
    desc: "Schéma maison : ligne médiane, 3 déclencheurs annotés.",
    source: "schema",
    schema: SCHEMA_PRESSING,
  },
  {
    dur: 14,
    name: "Sortie de balle 3+1",
    family: "TE",
    desc: "Schéma maison : circuit de passes courtes + appui orienté.",
    source: "schema",
    schema: SCHEMA_BLOC,
  },
];

function nextId() {
  return "b" + Math.random().toString(36).slice(2, 8);
}

function fmtClock(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── Live preview (scaled-down A4) ────────────────────────────────────────
function LivePreview({
  title,
  theme,
  format,
  blocks,
}: {
  title: string;
  theme: string;
  format: string;
  blocks: Block[];
}) {
  const startTimes = blocks.map((_, i) =>
    blocks.slice(0, i).reduce((s, x) => s + x.dur, 0),
  );
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden text-zinc-900 text-[10px]">
      <div className="border-b border-zinc-200 px-3 py-2.5">
        <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          Préparation de séance
        </div>
        <h3 className="mt-0.5 text-[13px] font-semibold tracking-tight truncate">
          {title || "Sans titre"}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-zinc-500 font-mono">
          <span>jeu. 14 nov.</span>
          <span>U17</span>
          <span>{blocks.reduce((s, b) => s + b.dur, 0)} min</span>
          <span>{blocks.length} bloc{blocks.length > 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-zinc-200 text-[9px]">
        <div className="px-3 py-1.5 border-r border-zinc-200">
          <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
            Thème
          </div>
          <div className="mt-0.5 font-medium text-zinc-800 truncate">{theme}</div>
        </div>
        <div className="px-3 py-1.5">
          <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
            Format
          </div>
          <div className="mt-0.5 font-medium text-zinc-800">{format}</div>
        </div>
      </div>

      <ol>
        {blocks.length === 0 && (
          <li className="px-3 py-6 text-center text-[10px] text-zinc-400">
            Ajoute un bloc pour démarrer la fiche.
          </li>
        )}
        {blocks.map((b, idx) => {
          const start = startTimes[idx];
          return (
            <li
              key={b.id}
              className="grid grid-cols-[42px_42px_1fr_4px] gap-2 px-3 py-2 border-b border-zinc-200 last:border-b-0 animate-[prep-step-in_0.35s_ease_both]"
            >
              <div className="text-[8px] font-mono text-zinc-500 pt-0.5">
                {fmtClock(start)}
                <br />
                <span className="text-zinc-400">+{b.dur}&apos;</span>
              </div>
              <div className="relative h-9 w-12 rounded border border-zinc-200 bg-emerald-700 overflow-hidden">
                <div className="absolute inset-0 pitch-stripes opacity-90" />
                <div className="absolute inset-0">
                  <SchemaView data={b.schema} />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[8px] tabular-nums text-zinc-400">
                    {b.family}
                  </span>
                  <span className="text-[10px] font-semibold leading-tight truncate">
                    {b.name}
                  </span>
                </div>
                <p className="mt-0.5 text-[9px] leading-snug text-zinc-600 line-clamp-2">
                  {b.desc}
                </p>
              </div>
              <span
                className="self-stretch inline-block w-1 rounded-sm"
                style={{ background: FAMILY_COLOR[b.family] }}
              />
            </li>
          );
        })}
      </ol>

      <div className="px-3 py-2 border-t border-zinc-200 flex items-center justify-between text-[9px] text-zinc-500">
        <span>Page 1 / 1</span>
        <span className="font-mono">grinta.app</span>
      </div>
    </div>
  );
}

export function SessionWizardMockup() {
  const [title, setTitle] = useState("Conservation + sortie de balle");
  const [theme, setTheme] = useState("Mon équipe possède le ballon");
  const [format, setFormat] = useState("3:3 au 5:5");
  const [blocks, setBlocks] = useState<Block[]>(INITIAL_BLOCKS);
  const [libCursor, setLibCursor] = useState(0);
  const [schemaCursor, setSchemaCursor] = useState(0);

  const totalMin = useMemo(
    () => blocks.reduce((s, b) => s + b.dur, 0),
    [blocks],
  );

  const addFromLib = () => {
    const pick = LIB_PICKS[libCursor % LIB_PICKS.length];
    setBlocks((p) => [...p, { ...pick, id: nextId() }]);
    setLibCursor((c) => c + 1);
  };
  const addFromSchema = () => {
    const pick = SCHEMA_PICKS[schemaCursor % SCHEMA_PICKS.length];
    setBlocks((p) => [...p, { ...pick, id: nextId() }]);
    setSchemaCursor((c) => c + 1);
  };
  const removeBlock = (id: string) =>
    setBlocks((p) => p.filter((b) => b.id !== id));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-[0_30px_70px_-30px_rgba(24,24,27,.25)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 bg-zinc-50/60">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
          <span className="ml-3 font-mono text-[10.5px] uppercase tracking-widest text-zinc-500">
            grinta / séance / nouvelle
          </span>
        </div>
        <span className="text-[10.5px] font-mono text-zinc-400">
          démo interactive
        </span>
      </div>

      <div className="grid lg:grid-cols-[1fr_minmax(240px,360px)]">
        {/* Form */}
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight text-zinc-900">
                Construis la séance
              </h3>
              <p className="mt-1 text-[12.5px] text-zinc-500 leading-relaxed">
                Importe depuis ta bibliothèque ou crée un bloc directement sur
                schéma. La fiche A4 se compose à droite, prête à imprimer.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium font-mono tabular-nums bg-emerald-50 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              {totalMin} min · {blocks.length} bloc{blocks.length > 1 ? "s" : ""}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[12px] font-medium text-zinc-700">Titre</span>
              <input
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none focus:border-zinc-400 transition-colors"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-zinc-700">Thème</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none focus:border-zinc-400 transition-colors cursor-pointer"
              >
                {[
                  "Mon équipe possède le ballon",
                  "Mon équipe ne possède pas le ballon",
                  "Mon équipe récupère le ballon",
                  "Mon équipe perd le ballon",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-zinc-700">Format</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none focus:border-zinc-400 transition-colors cursor-pointer"
              >
                {["1:1", "2:2", "3:3", "3:3 au 5:5", "5:5", "8:8 à 11:11"].map(
                  (f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          <div className="mt-7">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-semibold text-zinc-900">Blocs</h4>
              <span className="text-[10.5px] font-mono text-zinc-400 tabular-nums">
                {blocks.length} bloc{blocks.length > 1 ? "s" : ""}
              </span>
            </div>

            <ol className="mt-3 flex flex-col gap-2">
              {blocks.map((b) => (
                <li
                  key={b.id}
                  className="group flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 px-2.5 py-2 transition-colors hover:bg-zinc-50 animate-[prep-step-in_0.35s_ease_both]"
                >
                  <GripVertical className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                  <span
                    className="inline-block w-1 self-stretch rounded-sm"
                    style={{ background: FAMILY_COLOR[b.family] }}
                  />
                  <div className="relative h-10 w-14 shrink-0 rounded border border-zinc-200 bg-emerald-700 overflow-hidden">
                    <div className="absolute inset-0 pitch-stripes opacity-90" />
                    <div className="absolute inset-0">
                      <SchemaView data={b.schema} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] tabular-nums text-zinc-400">
                        {b.family}
                      </span>
                      <span className="text-[12.5px] font-semibold truncate">
                        {b.name}
                      </span>
                      {b.source === "schema" && (
                        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 text-[9px] font-medium px-1.5 py-0.5">
                          <PencilRuler className="h-2.5 w-2.5" />
                          schéma
                        </span>
                      )}
                      {b.source === "lib" && (
                        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-zinc-100 text-zinc-600 text-[9px] font-medium px-1.5 py-0.5">
                          <Library className="h-2.5 w-2.5" />
                          lib
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-500 truncate">
                      {b.desc}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500 tabular-nums shrink-0">
                    {b.dur}&apos;
                  </span>
                  <button
                    type="button"
                    onClick={() => removeBlock(b.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-900 transition-colors"
                    aria-label="Retirer le bloc"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ol>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addFromLib}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-zinc-200 bg-white text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                <Library className="h-3.5 w-3.5" />
                Importer un exo
              </button>
              <button
                type="button"
                onClick={addFromSchema}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-zinc-200 bg-white text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                <PencilRuler className="h-3.5 w-3.5" />
                Créer sur schéma
              </button>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 pt-5 border-t border-zinc-100">
            <p className="text-[12px] text-zinc-500">
              La fiche A4 est mise à jour en direct.
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium text-white"
              style={{ background: "var(--accent)" }}
            >
              <FileDown className="h-3.5 w-3.5" />
              Exporter PDF
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Live preview */}
        <div className="border-t lg:border-t-0 lg:border-l border-zinc-200 bg-zinc-50/60 p-5 flex items-start justify-center">
          <div className="w-full max-w-[280px]">
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-2">
              Aperçu fiche A4
            </div>
            <LivePreview
              title={title}
              theme={theme}
              format={format}
              blocks={blocks}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
