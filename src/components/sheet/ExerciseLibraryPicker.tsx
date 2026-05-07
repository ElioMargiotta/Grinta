"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, Search, Sparkles } from "lucide-react";
import type { FocusFamily } from "./types";

export type LibraryExercise = {
  id: string;
  code: string | null;
  titre: string | null;
  name: string;
  theme: string | null;
  niveau: string | null;
  track: string | null;
  level: number | null;
  duree: string | null;
  description: string | null;
  organisation: string | null;
  forme_physique: string[] | null;
  tactique: string[] | null;
  mentalite: string[] | null;
  technique: string[] | null;
  variation_less_text: string | null;
  variation_more_text: string | null;
  main_image: string | null;
};

type PreparationPhases = {
  possession: boolean;
  losing: boolean;
  noPossession: boolean;
  recovering: boolean;
};

const PHASE_TO_THEME: Record<keyof PreparationPhases, string> = {
  possession: "Mon équipe possède le ballon",
  losing: "Mon équipe perd le ballon",
  noPossession: "Mon équipe ne possède pas le ballon",
  recovering: "Mon équipe récupère le ballon",
};

const FAMILY_COLUMN: Record<FocusFamily, keyof Pick<LibraryExercise,
  "forme_physique" | "tactique" | "mentalite" | "technique">> = {
  TE: "technique",
  TA: "tactique",
  PE: "forme_physique",
  AT: "mentalite",
};

const FAMILY_LABEL: Record<FocusFamily, string> = {
  TE: "Technique",
  TA: "Tactique",
  PE: "Forme physique",
  AT: "Mentalité",
};

export function ExerciseLibraryPicker({
  open,
  onClose,
  exercises,
  phases,
  focusFamilies,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  exercises: LibraryExercise[];
  phases: PreparationPhases;
  focusFamilies: FocusFamily[];
  onPick: (ex: LibraryExercise) => void;
}) {
  const [search, setSearch] = useState("");
  const [overridePhase, setOverridePhase] = useState<string | null>(null);

  const activeThemes = useMemo(() => {
    if (overridePhase) return [overridePhase];
    return Object.entries(phases)
      .filter(([, on]) => on)
      .map(([k]) => PHASE_TO_THEME[k as keyof PreparationPhases]);
  }, [phases, overridePhase]);

  const filtered = useMemo(() => {
    let list = exercises;
    if (activeThemes.length > 0) {
      list = list.filter((e) => e.theme && activeThemes.includes(e.theme));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          (e.titre ?? e.name).toLowerCase().includes(q) ||
          (e.description ?? "").toLowerCase().includes(q) ||
          (e.code ?? "").toLowerCase().includes(q),
      );
    }
    // Sort by focus relevance: more tags in the selected families first.
    if (focusFamilies.length > 0) {
      list = [...list].sort((a, b) => {
        const score = (e: LibraryExercise) =>
          focusFamilies.reduce(
            (s, f) => s + (e[FAMILY_COLUMN[f]]?.length ?? 0),
            0,
          );
        return score(b) - score(a);
      });
    }
    return list;
  }, [exercises, activeThemes, search, focusFamilies]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-end bg-black/30 backdrop-blur-sm">
      <div
        className="relative flex h-full w-full max-w-2xl flex-col bg-[#f8f8f9] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Close"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="text-[14px] font-semibold text-zinc-900">
                Bibliothèque d&apos;exercices
              </div>
              <div className="text-[11px] text-zinc-500">
                {filtered.length} exercices · pré-filtrés par phase de jeu et focus
              </div>
            </div>
          </div>
          <div className="text-[11px] text-zinc-400">
            Cliquer pour importer
          </div>
        </header>

        {/* Search + filter status */}
        <div className="border-b border-zinc-200 bg-white px-5 py-3">
          <label className="flex items-center gap-2 rounded-[9px] border-[1.5px] border-zinc-200 bg-white px-3 py-1.5 text-[13px] focus-within:border-zinc-900 focus-within:shadow-[0_0_0_3px_rgb(12_12_13/0.07)]">
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par titre, code…"
              className="w-full border-0 bg-transparent p-0 outline-none placeholder:text-zinc-400"
            />
          </label>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-zinc-400">Phases:</span>
            {activeThemes.length === 0 ? (
              <span className="italic text-zinc-400">aucune sélectionnée</span>
            ) : (
              activeThemes.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-zinc-900 px-2 py-0.5 font-medium text-white"
                >
                  {t}
                </span>
              ))
            )}
            <span className="ml-auto text-zinc-400">Focus:</span>
            {focusFamilies.length === 0 ? (
              <span className="italic text-zinc-400">aucun</span>
            ) : (
              focusFamilies.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-zinc-300 bg-white px-2 py-0.5 font-mono font-semibold text-zinc-700"
                >
                  {f}
                </span>
              ))
            )}
          </div>

          {/* Manual phase override */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-zinc-400">Filtrer par phase:</span>
            <button
              type="button"
              onClick={() => setOverridePhase(null)}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${
                overridePhase === null
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              Auto (session)
            </button>
            {Object.values(PHASE_TO_THEME).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOverridePhase(t)}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                  overridePhase === t
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {t.replace("Mon équipe ", "")}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-[13px] text-zinc-500">
              Aucun exercice ne correspond. Modifiez les filtres ou la
              recherche.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((ex) => (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => onPick(ex)}
                    className="flex w-full items-stretch gap-3 rounded-xl border border-zinc-200 bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
                  >
                    {ex.main_image ? (
                      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                        <Image
                          src={ex.main_image}
                          alt={ex.titre ?? ex.name}
                          fill
                          sizes="112px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-[10px] text-zinc-400">
                        No diagram
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                            {ex.theme}
                          </div>
                          <div className="mt-0.5 truncate text-[13px] font-semibold text-zinc-900">
                            {ex.titre ?? ex.name}
                          </div>
                        </div>
                        {ex.duree && (
                          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">
                            {ex.duree}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {ex.niveau}
                        {ex.code && (
                          <span className="ml-2 font-mono text-[10px] text-zinc-400">
                            {ex.code}
                          </span>
                        )}
                      </div>
                      {focusFamilies.length > 0 && (
                        <div className="mt-auto flex flex-wrap gap-1">
                          {focusFamilies.flatMap((f) =>
                            (ex[FAMILY_COLUMN[f]] ?? []).slice(0, 2).map((tag, i) => (
                              <span
                                key={`${f}-${i}`}
                                className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600"
                                title={`${FAMILY_LABEL[f]}: ${tag}`}
                              >
                                <span className="font-mono opacity-60">{f}</span>
                                <span className="max-w-[160px] truncate">{tag}</span>
                              </span>
                            )),
                          )}
                        </div>
                      )}
                    </div>
                    <Sparkles className="h-3.5 w-3.5 shrink-0 self-center text-zinc-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close picker"
        className="absolute inset-0 -z-10"
      />
    </div>
  );
}

export function buildMainBlockFromLibrary(
  ex: LibraryExercise,
  focusFamilies: FocusFamily[],
): {
  description: string;
  coaching: string;
  organisation: string;
  variations: string;
  duration: string;
  exerciseId: string;
  imageUrl: string;
} {
  // The "coaching" main-block field is filled with tags from the focus
  // families the coach picked in Step 1. Falls back to all 4 families
  // joined if the user hasn't selected any.
  const families: FocusFamily[] =
    focusFamilies.length > 0 ? focusFamilies : ["TE", "TA", "PE", "AT"];

  const coachingLines: string[] = [];
  for (const f of families) {
    const tags = ex[FAMILY_COLUMN[f]] ?? [];
    if (tags.length === 0) continue;
    coachingLines.push(`${FAMILY_LABEL[f]} (${f}):`);
    for (const t of tags) coachingLines.push(`• ${t}`);
    coachingLines.push("");
  }

  const variationParts: string[] = [];
  if (ex.variation_less_text) {
    variationParts.push(`− ${ex.variation_less_text}`);
  }
  if (ex.variation_more_text) {
    variationParts.push(`+ ${ex.variation_more_text}`);
  }

  return {
    description: ex.description ?? "",
    coaching: coachingLines.join("\n").trim(),
    organisation: ex.organisation ?? "",
    variations: variationParts.join("\n\n"),
    duration: ex.duree ?? "",
    exerciseId: ex.id,
    imageUrl: ex.main_image ?? "",
  };
}
