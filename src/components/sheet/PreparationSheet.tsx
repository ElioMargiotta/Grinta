"use client";

import { ChevronDown, ChevronUp, FileText, Printer, Save } from "lucide-react";
import { useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { savePreparationAction } from "@/app/[locale]/(app)/planner/[teamId]/sessions/[sessionId]/preparation/actions";
import { exampleSheet } from "./example";
import { FullPitch, HalfPitch } from "./Pitch";
import {
  ColumnHeader,
  Hint,
  HintBanner,
  SectionHeader,
  SheetInput,
  SheetTextarea,
} from "./SheetField";
import { type PreparationData } from "./types";

const cellClass = "p-2";

function HowToUse() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-blue-900"
      >
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          How to fill out this sheet
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t border-blue-200 px-3 py-3 text-sm text-blue-900">
          <p className="mb-2">
            This is the official ASF training preparation sheet. It walks you
            through one full session: warmup, main work, match, cooldown, and
            post-session reflection.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Top block</strong> — date / team / coach, plus the game
              moments you want to focus on (possession, losing the ball, etc.)
              and the session&apos;s focus and objectives.
            </li>
            <li>
              <strong>Partie Initiale</strong> — three short blocks: a loose
              warmup (Phase 1), a technical / tactical warmup (Phase 2), and an
              explosive block (Phase 3). Phase 1 has an optional injury-
              prevention sub-block (ankle / knee / hip / hamstring, 25 s each).
            </li>
            <li>
              <strong>Two main exercises</strong> — pick &quot;Forme jouée&quot;
              (small-sided game) or &quot;Exercice&quot; (drill). Fill in the
              setup, coaching cues, and easier (−) / harder (+) variations.
            </li>
            <li>
              <strong>Jeu</strong> — match-style game on a full pitch.{" "}
              <strong>Fin</strong> — cooldown and quick debrief.{" "}
              <strong>Réflexion</strong> — your post-session notes.
            </li>
          </ul>
          <p className="mt-2">
            All fields are optional — fill what you need. The sheet you see
            here is what gets exported when you click &quot;Export PDF&quot;.
          </p>
          <p className="mt-2 text-xs text-blue-800">
            Hint: click <strong>Load example</strong> to see a fully filled
            sheet, then clear it and adapt to your own session.
          </p>
        </div>
      )}
    </div>
  );
}

export function PreparationSheet({
  teamId,
  sessionId,
  initial,
}: {
  teamId: string;
  sessionId: string;
  initial: PreparationData;
}) {
  const [data, setData] = useState<PreparationData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();

  function patch(updater: (d: PreparationData) => PreparationData) {
    setDirty(true);
    setData(updater);
  }

  function update<K extends keyof PreparationData>(
    key: K,
    value: PreparationData[K],
  ) {
    patch((d) => ({ ...d, [key]: value }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await savePreparationAction({
        teamId,
        sessionId,
        locale,
        data,
      });
      if (result?.error) setError(result.error);
      else {
        setSavedAt(new Date().toLocaleTimeString());
        setDirty(false);
      }
    });
  }

  function loadExample() {
    if (
      dirty &&
      !confirm(
        "This will replace the current sheet with an example. Continue?",
      )
    ) {
      return;
    }
    patch(() => exampleSheet());
  }

  const status = dirty
    ? savedAt
      ? `Unsaved changes (last saved ${savedAt})`
      : "Unsaved changes"
    : savedAt
      ? `Saved at ${savedAt}`
      : "Not saved yet";

  return (
    <div className="prep-export flex flex-col gap-4 print:block print:gap-0">
      <HowToUse />

      {/* Toolbar — hidden in print */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-3 shadow-sm print:hidden">
        <div className="text-sm text-zinc-600">{status}</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={loadExample}>
            <FileText className="h-4 w-4" />
            Load example
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Export PDF
          </Button>
          <Button size="sm" disabled={isPending} onClick={save}>
            <Save className="h-4 w-4" />
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">
          {error}
        </div>
      )}

      {/* Two A4 pages — side by side on wide screens, stacked on small. */}
      <div className="prep-sheet print:block">
      <div className="prep-pages flex flex-col items-stretch gap-6 lg:flex-row lg:items-start lg:justify-center print:block print:gap-0">

      {/* PAGE 1 */}
      <div className="prep-page mx-auto w-full max-w-[210mm] border border-zinc-300 bg-white text-zinc-900 lg:flex-1 print:max-w-none print:border-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-300 px-4 py-3">
          <div className="text-sm font-semibold tracking-wide text-zinc-700">ASF</div>
          <div className="text-base font-bold">Préparation d&apos;entraînement</div>
          <div className="text-sm font-semibold tracking-wide text-zinc-700">Grinta</div>
        </div>

        {/* Date / Équipe / Entraîneur */}
        <div className="grid grid-cols-[110px_1fr_110px_1fr_110px_1fr] border-b border-zinc-300">
          <div className="border-r border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-semibold">
            Date
          </div>
          <div className={`${cellClass} border-r border-zinc-300`}>
            <SheetInput
              value={data.date}
              onChange={(e) => update("date", e.target.value)}
              type="date"
            />
          </div>
          <div className="border-r border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-semibold">
            Équipe
            <div className="text-xs font-normal text-zinc-500 print:hidden">Team</div>
          </div>
          <div className={`${cellClass} border-r border-zinc-300`}>
            <SheetInput
              value={data.team}
              onChange={(e) => update("team", e.target.value)}
              placeholder="e.g., U15 Élite"
            />
          </div>
          <div className="border-r border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-semibold">
            Entraîneur
            <div className="text-xs font-normal text-zinc-500 print:hidden">Coach</div>
          </div>
          <div className={cellClass}>
            <SheetInput
              value={data.coach}
              onChange={(e) => update("coach", e.target.value)}
              placeholder="Your name"
            />
          </div>
        </div>

        {/* Legend (static) */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-zinc-300 px-4 py-2 text-xs text-zinc-700 sm:grid-cols-4">
          <div><span className="font-bold">X</span> &nbsp;Joueur/euse</div>
          <div>Dribble&nbsp; <span className="tracking-widest">∿➤</span></div>
          <div>Passe&nbsp; <span>—→</span></div>
          <div><span className="font-bold">O</span> &nbsp;Adversaire</div>
          <div>Course&nbsp; <span>--→</span></div>
          <div>Long ballon&nbsp; <span>⌒→</span></div>
        </div>

        {/* Game phases */}
        <HintBanner>
          Tick the moment(s) of the game this session focuses on.
        </HintBanner>
        <div className="grid grid-cols-1 gap-y-1 border-b border-zinc-300 px-4 py-2 text-xs sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:py-1">
          {[
            {
              key: "possession",
              label: "Mon équipe possède le ballon",
              en: "We have the ball",
            },
            {
              key: "losing",
              label: "Mon équipe perd le ballon",
              en: "We just lost it",
            },
            {
              key: "noPossession",
              label: "Mon équipe ne possède pas le ballon",
              en: "They have it",
            },
            {
              key: "recovering",
              label: "Mon équipe récupère le ballon",
              en: "We just won it back",
            },
          ].map(({ key, label, en }) => {
            const k = key as keyof PreparationData["phases"];
            return (
              <label key={key} className="inline-flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-zinc-900"
                  checked={data.phases[k]}
                  onChange={(e) =>
                    update("phases", { ...data.phases, [k]: e.target.checked })
                  }
                />
                <span>
                  {label}
                  <span className="ml-1 text-zinc-500 print:hidden">({en})</span>
                </span>
              </label>
            );
          })}
        </div>

        {/* Forme caractéristique / Focus / Objectifs / Questions */}
        <div className="grid grid-cols-[180px_1fr] border-b border-zinc-300">
          {[
            {
              k: "characteristicForm" as const,
              label: (
                <>
                  Forme caractéristique
                  <div className="text-xs font-normal text-zinc-500">(Situation de jeu)</div>
                  <Hint>
                    The real game situation this session is built around.
                  </Hint>
                </>
              ),
              placeholder: "e.g., Build-up from goalkeeper under high press",
              rows: 1,
            },
            {
              k: "focus" as const,
              label: (
                <>
                  Focus <span className="text-xs font-normal">(TE/TA/PE/AT)</span>
                  <Hint>
                    TE = Technique · TA = Tactique · PE = Physique · AT = Attitude
                  </Hint>
                </>
              ),
              placeholder: "e.g., TA — pressing triggers",
              rows: 1,
            },
            {
              k: "objectives" as const,
              label: (
                <>
                  Objectifs
                  <Hint>
                    What players should be able to do by the end. Start with an
                    action verb.
                  </Hint>
                </>
              ),
              placeholder:
                "e.g., Recognize the press trigger and play forward in 1–2 touches.",
              rows: 1,
            },
            {
              k: "developmentQuestions" as const,
              label: (
                <>
                  Questions de développement
                  <Hint>
                    Open questions you&apos;ll ask players to spark reflection.
                  </Hint>
                </>
              ),
              placeholder:
                "e.g., When does the #6 drop between the center backs?",
              rows: 1,
            },
          ].map(({ label, k, placeholder, rows }) => (
            <div key={k} className="contents">
              <div className="border-b border-r border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-bold last:border-b-0">
                {label}
              </div>
              <div className="border-b border-zinc-300 p-2 last:border-b-0">
                <SheetTextarea
                  rows={rows}
                  placeholder={placeholder}
                  value={data[k] as string}
                  onChange={(e) => update(k, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Partie Initiale */}
        <SectionHeader
          title={
            <span>
              Partie Initiale
              <span className="ml-2 text-xs font-normal text-zinc-500 print:hidden">
                (Initial part)
              </span>
            </span>
          }
          right={
            <span className="flex items-center gap-2">
              Durée :
              <SheetInput
                value={data.initial.duration}
                onChange={(e) =>
                  patch((d) => ({
                    ...d,
                    initial: { ...d.initial, duration: e.target.value },
                  }))
                }
                placeholder="e.g., 25 min"
                className="h-7 w-24"
              />
            </span>
          }
        />
        <HintBanner>
          The first part of the session: warmup → technical/tactical work →
          short explosive block.
        </HintBanner>

        {/* Phase 1 */}
        <div className="border-b border-zinc-300">
          <div className="grid grid-cols-[180px_1fr_1fr]">
            <div className="border-r border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm font-bold">
              Phase 1 – Echauffement
              <Hint>Loose warmup. Mobility, ball touches.</Hint>
            </div>
            <ColumnHeader>
              Description
              <span className="ml-1 font-normal text-zinc-500 print:hidden">
                (what players do)
              </span>
            </ColumnHeader>
            <div className="border-l border-zinc-300">
              <ColumnHeader>
                Organisation / Coaching
                <span className="ml-1 font-normal text-zinc-500 print:hidden">
                  (setup + cues)
                </span>
              </ColumnHeader>
            </div>

            <div className="row-span-2 border-r border-zinc-300 p-3">
              <HalfPitch className="mx-auto h-44 w-auto print:h-32" />
            </div>
            <div className="p-2">
              <SheetTextarea
                rows={6}
                placeholder="e.g., Players in pairs jog around half-pitch, ball rolling between them. 4 minutes."
                value={data.initial.phase1.description}
                onChange={(e) =>
                  patch((d) => ({
                    ...d,
                    initial: {
                      ...d.initial,
                      phase1: { ...d.initial.phase1, description: e.target.value },
                    },
                  }))
                }
              />
            </div>
            <div className="border-l border-zinc-300 p-2">
              <SheetTextarea
                rows={6}
                placeholder="e.g., Cones at corners. Cues: high-quality first touch, head up before passing."
                value={data.initial.phase1.coaching}
                onChange={(e) =>
                  patch((d) => ({
                    ...d,
                    initial: {
                      ...d.initial,
                      phase1: { ...d.initial.phase1, coaching: e.target.value },
                    },
                  }))
                }
              />
            </div>
          </div>

          {/* Stabilité corporelle (Prévention) */}
          <div className="border-t border-zinc-300">
            <div className="bg-zinc-100 px-3 py-1 text-sm font-bold">
              Stabilité corporelle (Prévention)
              <Hint>
                Optional injury-prevention block. ~25 s per body part.
              </Hint>
            </div>
            <div className="grid grid-cols-[180px_1fr_1fr]">
              {[
                {
                  label: "Cheville",
                  en: "Ankle",
                  k: "ankle" as const,
                  d: "e.g., Single-leg balance, 25s each side",
                  c: "Soft knee, gaze forward",
                },
                {
                  label: "Genou",
                  en: "Knee",
                  k: "knee" as const,
                  d: "e.g., Side-to-side mini squats, 25s",
                  c: "Knee tracks over the foot",
                },
                {
                  label: "Hanche",
                  en: "Hip",
                  k: "hip" as const,
                  d: "e.g., Bridge with single-leg lift, 25s",
                  c: "Squeeze glutes, neutral spine",
                },
                {
                  label: "Ischio-jambiers",
                  en: "Hamstrings",
                  k: "hamstring" as const,
                  d: "e.g., Nordic eccentrics, 25s — partner-assisted",
                  c: "Slow descent, control the last 10 cm",
                },
              ].map(({ label, en, k, d, c }) => (
                <div key={k} className="contents">
                  <div className="border-b border-r border-zinc-300 px-3 py-3 text-sm font-semibold last:border-b-0">
                    {label}
                    <div className="text-xs font-normal text-zinc-500 print:hidden">
                      {en}
                    </div>
                  </div>
                  <div className="border-b border-zinc-300 p-2 last:border-b-0">
                    <SheetTextarea
                      rows={2}
                      placeholder={d}
                      value={data.initial.phase1.prevention[k].description}
                      onChange={(e) =>
                        patch((dd) => ({
                          ...dd,
                          initial: {
                            ...dd.initial,
                            phase1: {
                              ...dd.initial.phase1,
                              prevention: {
                                ...dd.initial.phase1.prevention,
                                [k]: {
                                  ...dd.initial.phase1.prevention[k],
                                  description: e.target.value,
                                },
                              },
                            },
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="border-b border-l border-zinc-300 p-2 last:border-b-0">
                    <SheetTextarea
                      rows={2}
                      placeholder={c}
                      value={data.initial.phase1.prevention[k].coaching}
                      onChange={(e) =>
                        patch((dd) => ({
                          ...dd,
                          initial: {
                            ...dd.initial,
                            phase1: {
                              ...dd.initial.phase1,
                              prevention: {
                                ...dd.initial.phase1.prevention,
                                [k]: {
                                  ...dd.initial.phase1.prevention[k],
                                  coaching: e.target.value,
                                },
                              },
                            },
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-zinc-300 px-3 py-1 text-center text-xs text-zinc-600">
              Durée par répétition de chaque exercice : 25&apos;&apos;
            </div>
          </div>
        </div>

        {/* Phase 2 */}
        <div className="grid grid-cols-[180px_1fr_1fr] border-b border-zinc-300">
          <div className="border-r border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm font-bold">
            Phase 2 – Echauffement (TE/TA/PE)
            <Hint>
              Technical / tactical / physical warmup that builds toward the
              main session.
            </Hint>
          </div>
          <ColumnHeader>Description</ColumnHeader>
          <div className="border-l border-zinc-300">
            <ColumnHeader>Organisation / Coaching</ColumnHeader>
          </div>
          <div className="row-span-2 border-r border-zinc-300 p-3">
            <HalfPitch className="mx-auto h-44 w-auto" />
          </div>
          <div className="p-2">
            <SheetTextarea
              rows={6}
              placeholder="e.g., Rondo 4v2 in 8 m square, two-touch limit. 3 × 4 minutes."
              value={data.initial.phase2.description}
              onChange={(e) =>
                patch((d) => ({
                  ...d,
                  initial: {
                    ...d.initial,
                    phase2: { ...d.initial.phase2, description: e.target.value },
                  },
                }))
              }
            />
          </div>
          <div className="border-l border-zinc-300 p-2">
            <SheetTextarea
              rows={6}
              placeholder="e.g., Defenders rotate after winning the ball. Cue: scan before receiving."
              value={data.initial.phase2.coaching}
              onChange={(e) =>
                patch((d) => ({
                  ...d,
                  initial: {
                    ...d.initial,
                    phase2: { ...d.initial.phase2, coaching: e.target.value },
                  },
                }))
              }
            />
          </div>
        </div>

        {/* Phase 3 */}
        <div className="grid grid-cols-[180px_1fr_1fr] border-b border-zinc-300">
          <div className="border-r border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm font-bold">
            Phase 3 – Explosivité
            <Hint>
              Short bursts. Sprints, jumps, change of direction.
            </Hint>
          </div>
          <ColumnHeader>Description</ColumnHeader>
          <div className="border-l border-zinc-300">
            <ColumnHeader>Organisation / Coaching</ColumnHeader>
          </div>
          <div className="border-r border-zinc-300 p-2" />
          <div className="p-2">
            <SheetTextarea
              rows={5}
              placeholder="e.g., 4 × 10 m sprint with change of direction at the cone, 30s rest. 3 sets."
              value={data.initial.phase3.description}
              onChange={(e) =>
                patch((d) => ({
                  ...d,
                  initial: {
                    ...d.initial,
                    phase3: { ...d.initial.phase3, description: e.target.value },
                  },
                }))
              }
            />
          </div>
          <div className="border-l border-zinc-300 p-2">
            <SheetTextarea
              rows={5}
              placeholder="e.g., Full intensity. Walk back recovery. Stay low through the change of direction."
              value={data.initial.phase3.coaching}
              onChange={(e) =>
                patch((d) => ({
                  ...d,
                  initial: {
                    ...d.initial,
                    phase3: { ...d.initial.phase3, coaching: e.target.value },
                  },
                }))
              }
            />
          </div>
        </div>

        {/* Page 1 footer */}
        <div className="grid grid-cols-3 border-t border-zinc-300 px-4 py-2 text-xs text-zinc-500">
          <div>ASF</div>
          <div className="text-center">f_Préparation d&apos;entraînement</div>
          <div className="text-right">2025</div>
        </div>
      </div>
      {/* end PAGE 1 */}

      {/* PAGE 2 */}
      <div className="prep-page mx-auto w-full max-w-[210mm] border border-zinc-300 bg-white text-zinc-900 lg:flex-1 print:max-w-none print:border-0 print:break-before-page">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-300 px-4 py-3">
          <div className="text-sm font-semibold tracking-wide text-zinc-700">ASF</div>
          <div className="text-base font-bold">Préparation d&apos;entraînement</div>
          <div className="text-sm font-semibold tracking-wide text-zinc-700">Grinta</div>
        </div>

        {/* Main exercises */}
        {data.main.map((block, idx) => (
          <div key={idx} className="border-b border-zinc-300">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm font-bold">
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name={`main-${idx}-type`}
                    className="h-4 w-4 accent-zinc-900"
                    checked={block.type === "playForm"}
                    onChange={() => {
                      const next = [...data.main];
                      next[idx] = { ...block, type: "playForm" };
                      update("main", next);
                    }}
                  />
                  Forme jouée
                  <span className="text-xs font-normal text-zinc-500 print:hidden">
                    (game form)
                  </span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name={`main-${idx}-type`}
                    className="h-4 w-4 accent-zinc-900"
                    checked={block.type === "exercise"}
                    onChange={() => {
                      const next = [...data.main];
                      next[idx] = { ...block, type: "exercise" };
                      update("main", next);
                    }}
                  />
                  Exercice
                  <span className="text-xs font-normal text-zinc-500 print:hidden">
                    (drill)
                  </span>
                </label>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold">
                Durée :
                <SheetInput
                  value={block.duration}
                  onChange={(e) => {
                    const next = [...data.main];
                    next[idx] = { ...block, duration: e.target.value };
                    update("main", next);
                  }}
                  placeholder="e.g., 20 min"
                  className="h-7 w-24"
                />
              </div>
            </div>
            <HintBanner>
              Main work. Pick a small-sided game (Forme jouée) or a drill
              (Exercice). Describe what they do, your coaching cues, the
              setup, and easier (−) / harder (+) variations.
            </HintBanner>

            <div className="grid grid-cols-[200px_1fr_1fr]">
              <div className="row-span-4 border-r border-zinc-300 p-3">
                <FullPitch className="mx-auto h-72 w-auto print:h-48" />
              </div>
              <ColumnHeader>Description</ColumnHeader>
              <div className="border-l border-zinc-300">
                <ColumnHeader>Coaching</ColumnHeader>
              </div>
              <div className="p-2">
                <SheetTextarea
                  rows={7}
                  placeholder="e.g., 5v5 on 30×40 m, two small goals, 4 × 4 min sets."
                  value={block.description}
                  onChange={(e) => {
                    const next = [...data.main];
                    next[idx] = { ...block, description: e.target.value };
                    update("main", next);
                  }}
                />
              </div>
              <div className="border-l border-zinc-300 p-2">
                <SheetTextarea
                  rows={7}
                  placeholder="e.g., Encourage forward passes; reward goal off first switch."
                  value={block.coaching}
                  onChange={(e) => {
                    const next = [...data.main];
                    next[idx] = { ...block, coaching: e.target.value };
                    update("main", next);
                  }}
                />
              </div>
              <ColumnHeader>
                Organisation
                <span className="ml-1 font-normal text-zinc-500 print:hidden">
                  (setup)
                </span>
              </ColumnHeader>
              <div className="border-l border-zinc-300">
                <ColumnHeader>
                  Variations (+/−)
                  <span className="ml-1 font-normal text-zinc-500 print:hidden">
                    (easier / harder)
                  </span>
                </ColumnHeader>
              </div>
              <div className="p-2">
                <SheetTextarea
                  rows={3}
                  placeholder="e.g., 30×40 m, 4 mannequins as outlets, 2 GK at small goals."
                  value={block.organisation}
                  onChange={(e) => {
                    const next = [...data.main];
                    next[idx] = { ...block, organisation: e.target.value };
                    update("main", next);
                  }}
                />
              </div>
              <div className="border-l border-zinc-300 p-2">
                <SheetTextarea
                  rows={3}
                  placeholder="+ add a free player; − reduce field size, longer rest"
                  value={block.variations}
                  onChange={(e) => {
                    const next = [...data.main];
                    next[idx] = { ...block, variations: e.target.value };
                    update("main", next);
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Jeu */}
        <SectionHeader
          title={
            <span>
              Jeu
              <span className="ml-2 text-xs font-normal text-zinc-500 print:hidden">
                (Match-style game on a full pitch)
              </span>
            </span>
          }
          right={
            <span className="flex items-center gap-2">
              Durée :
              <SheetInput
                value={data.game.duration}
                onChange={(e) =>
                  update("game", { ...data.game, duration: e.target.value })
                }
                placeholder="e.g., 15 min"
                className="h-7 w-24"
              />
            </span>
          }
        />
        <div className="grid grid-cols-[200px_1fr] border-b border-zinc-300">
          <div className="border-r border-zinc-300 p-3">
            <FullPitch className="mx-auto h-48 w-auto print:h-36" />
          </div>
          <div className="p-2">
            <SheetTextarea
              rows={6}
              placeholder="e.g., 11v11 free play on full pitch. Last 15 minutes. Normal rules."
              value={data.game.notes}
              onChange={(e) =>
                update("game", { ...data.game, notes: e.target.value })
              }
            />
          </div>
        </div>

        {/* Fin */}
        <SectionHeader
          title={
            <span>
              Fin
              <span className="ml-2 text-xs font-normal text-zinc-500 print:hidden">
                (Cooldown / debrief)
              </span>
            </span>
          }
          right={
            <span className="flex items-center gap-2">
              Durée :
              <SheetInput
                value={data.end.duration}
                onChange={(e) =>
                  update("end", { ...data.end, duration: e.target.value })
                }
                placeholder="e.g., 5 min"
                className="h-7 w-24"
              />
            </span>
          }
        />
        <div className="border-b border-zinc-300 p-2">
          <SheetTextarea
            rows={3}
            placeholder="e.g., Walk to center circle. 60s breathing. Quick verbal debrief."
            value={data.end.notes}
            onChange={(e) => update("end", { ...data.end, notes: e.target.value })}
          />
        </div>

        {/* Réflexion */}
        <SectionHeader
          title={
            <span>
              Réflexion sur l&apos;entraînement
              <span className="ml-2 text-xs font-normal text-zinc-500 print:hidden">
                (Post-session notes)
              </span>
            </span>
          }
        />
        <div className="p-2">
          <SheetTextarea
            rows={4}
            placeholder="e.g., What worked, what didn't, who needs more individual work next week."
            value={data.reflection}
            onChange={(e) => update("reflection", e.target.value)}
          />
        </div>

        {/* Page 2 footer */}
        <div className="grid grid-cols-3 border-t border-zinc-300 px-4 py-2 text-xs text-zinc-500">
          <div>ASF</div>
          <div className="text-center">f_Préparation d&apos;entraînement</div>
          <div className="text-right">2025</div>
        </div>
      </div>
      {/* end PAGE 2 */}
      </div>
      {/* end pages flex */}
      </div>
      {/* end prep-sheet */}
    </div>
  );
}
