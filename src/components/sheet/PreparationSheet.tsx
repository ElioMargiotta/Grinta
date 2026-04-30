"use client";

import { ChevronDown, ChevronUp, FileText, Printer, Save } from "lucide-react";
import { useLocale } from "next-intl";
import {
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { savePreparationAction } from "@/app/[locale]/(app)/planner/[teamId]/sessions/[sessionId]/preparation/actions";
import { exampleSheet } from "./example";
import { type PreparationData } from "./types";

/* ============================================================
 * PDF EXPORT VIEW
 *   Two A4 pages with the SVG as fixed background, form text
 *   absolutely-positioned in mm. Hidden on screen, only visible
 *   when printing (see globals.css `.prep-export` rules).
 * ============================================================ */

const PAGE_W = 210; // mm
const PAGE_H = 297; // mm

type Box = { x: number; y: number; w: number; h: number };

function box({ x, y, w, h }: Box): CSSProperties {
  return {
    position: "absolute",
    left: `${x}mm`,
    top: `${y}mm`,
    width: `${w}mm`,
    height: `${h}mm`,
  };
}

const exportFieldClass =
  "block h-full w-full overflow-hidden whitespace-pre-wrap break-words px-1 py-0.5 text-[9px] leading-tight text-black";

function ExportText({ value, area }: { value: string; area: Box }) {
  return (
    <div style={box(area)} className={exportFieldClass}>
      {value}
    </div>
  );
}

function ExportCheck({ checked, area }: { checked: boolean; area: Box }) {
  return (
    <div
      style={box(area)}
      className="flex items-center justify-center text-[10px] font-bold leading-none text-black"
    >
      {checked ? "✓" : ""}
    </div>
  );
}

function ExportPage({
  bg,
  children,
}: {
  bg: string;
  children: ReactNode;
}) {
  return (
    <div
      className="prep-page relative bg-white"
      style={{ width: `${PAGE_W}mm`, height: `${PAGE_H}mm` }}
    >
      <img
        src={bg}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      />
      {children}
    </div>
  );
}

/* ----- PDF zones (mm coordinates on 210x297 A4) -----
 * Each section keeps its own zone block so we can iterate
 * section-by-section without hunting through one giant table. */

const Z_GLOBAL = {
  date: { x: 32, y: 21.5, w: 42, h: 10 },
  team: { x: 80, y: 21.5, w: 41, h: 10 },
  coach: { x: 142, y: 21.5, w: 44, h: 10 },

  phasePossession: { x: 14, y: 40.5, w: 4, h: 4 },
  phaseLosing: { x: 61.5, y: 40.5, w: 4, h: 4 },
  phaseNoPossession: { x: 105, y: 40.5, w: 4, h: 4 },
  phaseRecovering: { x: 153.5, y: 40.5, w: 4, h: 4 },

  characteristicForm: { x: 63, y: 48, w: 134, h: 9 },
  focus: { x: 63, y: 57.5, w: 134, h: 7 },
  objectives: { x: 63, y: 64, w: 134, h: 7 },
  developmentQuestions: { x: 63, y: 74, w: 134, h: 10 },
} as const;

// Placeholder zones for later sections — kept here so the PDF
// keeps rendering existing data while we iterate. They'll be
// re-calibrated as we build each web section.
const Z_INITIAL = {
  duration: { x: 149.5, y: 86, w: 39, h: 6 },
  phase1Description: { x: 75, y: 99, w: 60, h: 39 },
  phase1Coaching: { x: 137, y: 99, w: 60, h: 39 },
  ankleDescription: { x: 96, y: 140, w: 45, h: 9 },
  ankleCoaching: { x: 137, y: 140, w: 60, h: 9 },
  kneeDescription: { x: 96, y: 152, w: 45, h: 9 },
  kneeCoaching: { x: 137, y: 152, w: 60, h: 9 },
  hipDescription: { x: 96, y: 162, w: 45, h: 8 },
  hipCoaching: { x: 137, y: 162, w: 62, h: 8 },
  hamstringDescription: { x: 96, y: 171, w: 45, h: 14 },
  hamstringCoaching: { x: 137, y: 171, w: 62, h: 14 },
  phase2Description: { x: 65, y: 200, w: 70, h: 35 },
  phase2Coaching: { x: 138, y: 200, w: 62, h: 35 },
  phase3Description: { x: 65, y: 248, w: 70, h: 36 },
  phase3Coaching: { x: 138, y: 248, w: 62, h: 36 },
} as const;

const Z_MAIN_1 = {
  duration: { x: 161, y: 20, w: 39, h: 6 },
  description: { x: 78, y: 32, w: 60, h: 41 },
  coaching: { x: 138, y: 32, w: 62, h: 41 },
  organisation: { x: 78, y: 80, w: 60, h: 22 },
  variations: { x: 138, y: 80, w: 62, h: 22 },
  playForm: { x: 8, y: 21, w: 4, h: 4 },
  exercise: { x: 38, y: 21, w: 4, h: 4 },
} as const;

const Z_MAIN_2 = {
  duration: { x: 161, y: 106, w: 39, h: 6 },
  description: { x: 78, y: 119, w: 60, h: 40 },
  coaching: { x: 138, y: 119, w: 62, h: 40 },
  organisation: { x: 78, y: 165, w: 60, h: 22 },
  variations: { x: 138, y: 165, w: 62, h: 22 },
  playForm: { x: 8, y: 107, w: 4, h: 4 },
  exercise: { x: 38, y: 107, w: 4, h: 4 },
} as const;

const Z_END = {
  gameDuration: { x: 161, y: 191, w: 39, h: 6 },
  gameNotes: { x: 78, y: 200, w: 122, h: 26 },
  endDuration: { x: 161, y: 232, w: 39, h: 6 },
  endNotes: { x: 12, y: 240, w: 188, h: 22 },
  reflection: { x: 12, y: 269, w: 188, h: 18 },
} as const;

function PdfExport({ data }: { data: PreparationData }) {
  return (
    <div className="prep-export hidden print:block">
      <ExportPage bg="/page1.svg">
        {/* Global */}
        <ExportText value={data.date} area={Z_GLOBAL.date} />
        <ExportText value={data.team} area={Z_GLOBAL.team} />
        <ExportText value={data.coach} area={Z_GLOBAL.coach} />

        <ExportCheck
          checked={data.phases.possession}
          area={Z_GLOBAL.phasePossession}
        />
        <ExportCheck
          checked={data.phases.losing}
          area={Z_GLOBAL.phaseLosing}
        />
        <ExportCheck
          checked={data.phases.noPossession}
          area={Z_GLOBAL.phaseNoPossession}
        />
        <ExportCheck
          checked={data.phases.recovering}
          area={Z_GLOBAL.phaseRecovering}
        />

        <ExportText
          value={data.characteristicForm}
          area={Z_GLOBAL.characteristicForm}
        />
        <ExportText value={data.focus} area={Z_GLOBAL.focus} />
        <ExportText value={data.objectives} area={Z_GLOBAL.objectives} />
        <ExportText
          value={data.developmentQuestions}
          area={Z_GLOBAL.developmentQuestions}
        />

        {/* Initial part */}
        <ExportText value={data.initial.duration} area={Z_INITIAL.duration} />
        <ExportText
          value={data.initial.phase1.description}
          area={Z_INITIAL.phase1Description}
        />
        <ExportText
          value={data.initial.phase1.coaching}
          area={Z_INITIAL.phase1Coaching}
        />
        <ExportText
          value={data.initial.phase1.prevention.ankle.description}
          area={Z_INITIAL.ankleDescription}
        />
        <ExportText
          value={data.initial.phase1.prevention.ankle.coaching}
          area={Z_INITIAL.ankleCoaching}
        />
        <ExportText
          value={data.initial.phase1.prevention.knee.description}
          area={Z_INITIAL.kneeDescription}
        />
        <ExportText
          value={data.initial.phase1.prevention.knee.coaching}
          area={Z_INITIAL.kneeCoaching}
        />
        <ExportText
          value={data.initial.phase1.prevention.hip.description}
          area={Z_INITIAL.hipDescription}
        />
        <ExportText
          value={data.initial.phase1.prevention.hip.coaching}
          area={Z_INITIAL.hipCoaching}
        />
        <ExportText
          value={data.initial.phase1.prevention.hamstring.description}
          area={Z_INITIAL.hamstringDescription}
        />
        <ExportText
          value={data.initial.phase1.prevention.hamstring.coaching}
          area={Z_INITIAL.hamstringCoaching}
        />
        <ExportText
          value={data.initial.phase2.description}
          area={Z_INITIAL.phase2Description}
        />
        <ExportText
          value={data.initial.phase2.coaching}
          area={Z_INITIAL.phase2Coaching}
        />
        <ExportText
          value={data.initial.phase3.description}
          area={Z_INITIAL.phase3Description}
        />
        <ExportText
          value={data.initial.phase3.coaching}
          area={Z_INITIAL.phase3Coaching}
        />
      </ExportPage>

      <ExportPage bg="/page2.svg">
        {/* Main exercise 1 */}
        <ExportCheck
          checked={data.main[0].type === "playForm"}
          area={Z_MAIN_1.playForm}
        />
        <ExportCheck
          checked={data.main[0].type === "exercise"}
          area={Z_MAIN_1.exercise}
        />
        <ExportText value={data.main[0].duration} area={Z_MAIN_1.duration} />
        <ExportText
          value={data.main[0].description}
          area={Z_MAIN_1.description}
        />
        <ExportText value={data.main[0].coaching} area={Z_MAIN_1.coaching} />
        <ExportText
          value={data.main[0].organisation}
          area={Z_MAIN_1.organisation}
        />
        <ExportText
          value={data.main[0].variations}
          area={Z_MAIN_1.variations}
        />

        {/* Main exercise 2 */}
        <ExportCheck
          checked={data.main[1].type === "playForm"}
          area={Z_MAIN_2.playForm}
        />
        <ExportCheck
          checked={data.main[1].type === "exercise"}
          area={Z_MAIN_2.exercise}
        />
        <ExportText value={data.main[1].duration} area={Z_MAIN_2.duration} />
        <ExportText
          value={data.main[1].description}
          area={Z_MAIN_2.description}
        />
        <ExportText value={data.main[1].coaching} area={Z_MAIN_2.coaching} />
        <ExportText
          value={data.main[1].organisation}
          area={Z_MAIN_2.organisation}
        />
        <ExportText
          value={data.main[1].variations}
          area={Z_MAIN_2.variations}
        />

        {/* Jeu / Fin / Réflexion */}
        <ExportText value={data.game.duration} area={Z_END.gameDuration} />
        <ExportText value={data.game.notes} area={Z_END.gameNotes} />
        <ExportText value={data.end.duration} area={Z_END.endDuration} />
        <ExportText value={data.end.notes} area={Z_END.endNotes} />
        <ExportText value={data.reflection} area={Z_END.reflection} />
      </ExportPage>
    </div>
  );
}

/* ============================================================
 * WEB FORM
 *   Five clean cards. Section 1 (Global) is fully built;
 *   the rest are placeholders we'll replace step by step.
 * ============================================================ */

function FieldLabel({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-1">
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function inputClass(extra = "") {
  return `w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900/20 ${extra}`;
}

/* Mirror the export box's text-rendering rules to measure whether
 * `text` would fit inside a `widthMm × heightMm` zone in the PDF.
 * Used to block keystrokes that would push content past the visible
 * area (e.g. bullet-pointed lines), since the export box itself
 * just clips overflow. */
const EXPORT_FONT_PX = 9;
const EXPORT_LINE_HEIGHT = 1.25;
const EXPORT_PAD_Y = 2;
const EXPORT_PAD_X = 4;

function fitsInExportBox(
  text: string,
  widthMm: number,
  heightMm: number,
): boolean {
  if (typeof document === "undefined") return true;
  const mirror = document.createElement("div");
  mirror.style.position = "absolute";
  mirror.style.top = "-10000px";
  mirror.style.left = "-10000px";
  mirror.style.boxSizing = "border-box";
  mirror.style.width = `${widthMm}mm`;
  mirror.style.padding = `${EXPORT_PAD_Y}px ${EXPORT_PAD_X}px`;
  mirror.style.fontSize = `${EXPORT_FONT_PX}px`;
  mirror.style.lineHeight = `${EXPORT_LINE_HEIGHT}`;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.overflowWrap = "break-word";
  // Trailing newline doesn't count toward height in many engines —
  // append a zero-width sentinel so the mirror reflects the actual
  // last line.
  mirror.textContent = text + "​";
  document.body.appendChild(mirror);
  const px = mirror.offsetHeight;
  document.body.removeChild(mirror);
  const mm2px = 96 / 25.4;
  return px <= heightMm * mm2px + 1;
}

function useFits(text: string, widthMm: number, heightMm: number) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return useMemo(
    () => (mounted ? fitsInExportBox(text, widthMm, heightMm) : true),
    [mounted, text, widthMm, heightMm],
  );
}

function FitTextarea({
  value,
  onChange,
  area,
  rows = 5,
  placeholder,
  maxChars,
}: {
  value: string;
  onChange: (v: string) => void;
  area: { w: number; h: number };
  rows?: number;
  placeholder?: string;
  maxChars?: number;
}) {
  const fits = useFits(value, area.w, area.h);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    // Always allow shrinking (backspace, delete, paste-shorter).
    if (next.length < value.length) {
      onChange(next);
      return;
    }
    if (maxChars !== undefined && next.length > maxChars) return;
    if (!fitsInExportBox(next, area.w, area.h)) return;
    onChange(next);
  }

  return (
    <div>
      <textarea
        rows={rows}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={inputClass(
          `resize-none ${fits ? "" : "border-red-400 focus:border-red-500 focus:ring-red-500/20"}`,
        )}
      />
      <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
        <span className={fits ? "text-zinc-400" : "text-red-600"}>
          {fits ? "Fits the PDF box" : "Too tall — will be clipped on PDF"}
        </span>
        {maxChars !== undefined && (
          <span>
            {value.length}/{maxChars}
          </span>
        )}
      </div>
    </div>
  );
}

function GlobalSection({
  data,
  patch,
}: {
  data: PreparationData;
  patch: (updater: (d: PreparationData) => PreparationData) => void;
}) {
  const phaseOptions = [
    {
      key: "possession" as const,
      label: "Mon équipe possède le ballon",
      en: "We have the ball",
    },
    {
      key: "losing" as const,
      label: "Mon équipe perd le ballon",
      en: "We just lost it",
    },
    {
      key: "noPossession" as const,
      label: "Mon équipe ne possède pas le ballon",
      en: "They have it",
    },
    {
      key: "recovering" as const,
      label: "Mon équipe récupère le ballon",
      en: "We just won it back",
    },
  ];

  return (
    <Card>
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-lg font-bold text-zinc-900">1. Global</h2>
        <span className="text-xs text-zinc-500">
          Session metadata, game moments, and overall focus.
        </span>
      </div>

      {/* Date / Équipe / Entraîneur */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <FieldLabel title="Date" />
          <input
            type="date"
            value={data.date}
            onChange={(e) =>
              patch((d) => ({ ...d, date: e.target.value }))
            }
            className={inputClass()}
          />
        </div>
        <div>
          <FieldLabel title="Équipe" hint="Team" />
          <input
            type="text"
            value={data.team}
            onChange={(e) =>
              patch((d) => ({ ...d, team: e.target.value }))
            }
            placeholder="U15 Élite"
            className={inputClass()}
          />
        </div>
        <div>
          <FieldLabel title="Entraîneur" hint="Coach" />
          <input
            type="text"
            value={data.coach}
            onChange={(e) =>
              patch((d) => ({ ...d, coach: e.target.value }))
            }
            placeholder="Your name"
            className={inputClass()}
          />
        </div>
      </div>

      {/* Game moments */}
      <div className="mt-5">
        <FieldLabel
          title="Moments du jeu"
          hint="Tick the moment(s) of the game this session focuses on."
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {phaseOptions.map(({ key, label, en }) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-zinc-900"
                checked={data.phases[key]}
                onChange={(e) =>
                  patch((d) => ({
                    ...d,
                    phases: { ...d.phases, [key]: e.target.checked },
                  }))
                }
              />
              <span>
                {label}
                <span className="ml-1 text-xs text-zinc-500">({en})</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Long text fields */}
      <div className="mt-5 grid grid-cols-1 gap-4">
        <div>
          <FieldLabel
            title="Forme caractéristique"
            hint="Situation de jeu — the real game situation this session is built around."
          />
          <textarea
            rows={2}
            maxLength={230}
            value={data.characteristicForm}
            onChange={(e) =>
              patch((d) => ({ ...d, characteristicForm: e.target.value }))
            }
            placeholder="e.g., Build-up from goalkeeper under high press"
            className={inputClass("resize-none")}
          />
          <div className="mt-1 text-right text-xs text-zinc-400">
            {data.characteristicForm.length}/230
          </div>
        </div>
        <div>
          <FieldLabel
            title="Focus"
            hint="TE = Technique · TA = Tactique · PE = Physique · AT = Attitude"
          />
          <textarea
            rows={2}
            maxLength={115}
            value={data.focus}
            onChange={(e) =>
              patch((d) => ({ ...d, focus: e.target.value }))
            }
            placeholder="e.g., TA — pressing triggers"
            className={inputClass("resize-none")}
          />
          <div className="mt-1 text-right text-xs text-zinc-400">
            {data.focus.length}/115
          </div>
        </div>
        <div>
          <FieldLabel
            title="Objectifs"
            hint="What players should be able to do by the end. Start with an action verb."
          />
          <textarea
            rows={2}
            maxLength={230}
            value={data.objectives}
            onChange={(e) =>
              patch((d) => ({ ...d, objectives: e.target.value }))
            }
            placeholder="e.g., Recognize the press trigger and play forward in 1–2 touches."
            className={inputClass("resize-none")}
          />
          <div className="mt-1 text-right text-xs text-zinc-400">
            {data.objectives.length}/230
          </div>
        </div>
        <div>
          <FieldLabel
            title="Questions de développement"
            hint="Open questions you'll ask players to spark reflection."
          />
          <textarea
            rows={2}
            value={data.developmentQuestions}
            onChange={(e) =>
              patch((d) => ({ ...d, developmentQuestions: e.target.value }))
            }
            placeholder="e.g., When does the #6 drop between the center backs?"
            className={inputClass("resize-none")}
          />
        </div>
      </div>
    </Card>
  );
}

function SubsectionHeader({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-sm font-bold text-zinc-900">{title}</div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function InitialSection({
  data,
  patch,
}: {
  data: PreparationData;
  patch: (updater: (d: PreparationData) => PreparationData) => void;
}) {
  function setInitial<K extends keyof PreparationData["initial"]>(
    key: K,
    value: PreparationData["initial"][K],
  ) {
    patch((d) => ({ ...d, initial: { ...d.initial, [key]: value } }));
  }

  function setPhase1<K extends keyof PreparationData["initial"]["phase1"]>(
    key: K,
    value: PreparationData["initial"]["phase1"][K],
  ) {
    patch((d) => ({
      ...d,
      initial: {
        ...d.initial,
        phase1: { ...d.initial.phase1, [key]: value },
      },
    }));
  }

  function setPrevention(
    key: keyof PreparationData["initial"]["phase1"]["prevention"],
    field: "description" | "coaching",
    value: string,
  ) {
    patch((d) => ({
      ...d,
      initial: {
        ...d.initial,
        phase1: {
          ...d.initial.phase1,
          prevention: {
            ...d.initial.phase1.prevention,
            [key]: { ...d.initial.phase1.prevention[key], [field]: value },
          },
        },
      },
    }));
  }

  const preventionRows = [
    { key: "ankle" as const, label: "Cheville", en: "Ankle" },
    { key: "knee" as const, label: "Genou", en: "Knee" },
    { key: "hip" as const, label: "Hanche", en: "Hip" },
    { key: "hamstring" as const, label: "Ischio-jambiers", en: "Hamstrings" },
  ];

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-bold text-zinc-900">
            2. Partie Initiale
          </h2>
          <span className="text-xs text-zinc-500">
            Warmup → technical/tactical work → short explosive block.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-700">Durée</span>
          <input
            type="text"
            value={data.initial.duration}
            onChange={(e) => setInitial("duration", e.target.value)}
            placeholder="25 min"
            className={inputClass("h-9 w-28")}
          />
        </div>
      </div>

      {/* Phase 1 */}
      <div className="mt-2 rounded-md border border-zinc-200 p-3">
        <SubsectionHeader
          title="Phase 1 — Échauffement"
          hint="Loose warmup. Mobility, ball touches."
        />
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <FieldLabel title="Description" hint="What players do" />
            <FitTextarea
              rows={5}
              maxChars={420}
              area={{
                w: Z_INITIAL.phase1Description.w,
                h: Z_INITIAL.phase1Description.h,
              }}
              value={data.initial.phase1.description}
              onChange={(v) => setPhase1("description", v)}
              placeholder="e.g., Pairs jog around half-pitch, ball rolling between them. 4 min."
            />
          </div>
          <div>
            <FieldLabel
              title="Organisation / Coaching"
              hint="Setup + cues"
            />
            <FitTextarea
              rows={5}
              maxChars={420}
              area={{
                w: Z_INITIAL.phase1Coaching.w,
                h: Z_INITIAL.phase1Coaching.h,
              }}
              value={data.initial.phase1.coaching}
              onChange={(v) => setPhase1("coaching", v)}
              placeholder="e.g., Cones at corners. Cues: high-quality first touch, head up before passing."
            />
          </div>
        </div>

        {/* Stabilité corporelle (Prévention) */}
        <div className="mt-4 rounded-md bg-zinc-50 p-3">
          <SubsectionHeader
            title="Stabilité corporelle (Prévention)"
            hint="Optional injury-prevention block. ~25 s per body part."
          />
          <div className="mt-2 flex flex-col gap-3">
            {preventionRows.map(({ key, label, en }) => (
              <div
                key={key}
                className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr_1fr] md:items-start"
              >
                <div className="pt-1 text-sm font-semibold text-zinc-800">
                  {label}
                  <span className="ml-1 text-xs font-normal text-zinc-500">
                    ({en})
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={data.initial.phase1.prevention[key].description}
                  onChange={(e) =>
                    setPrevention(key, "description", e.target.value)
                  }
                  placeholder="Description"
                  className={inputClass("resize-none")}
                />
                <textarea
                  rows={2}
                  value={data.initial.phase1.prevention[key].coaching}
                  onChange={(e) =>
                    setPrevention(key, "coaching", e.target.value)
                  }
                  placeholder="Coaching cue"
                  className={inputClass("resize-none")}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 text-right text-xs text-zinc-500">
            Durée par répétition de chaque exercice : 25&apos;&apos;
          </div>
        </div>
      </div>

      {/* Phase 2 */}
      <div className="mt-3 rounded-md border border-zinc-200 p-3">
        <SubsectionHeader
          title="Phase 2 — Échauffement (TE/TA/PE)"
          hint="Technical / tactical / physical warmup that builds toward the main session."
        />
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <FieldLabel title="Description" />
            <textarea
              rows={5}
              value={data.initial.phase2.description}
              onChange={(e) =>
                setInitial("phase2", {
                  ...data.initial.phase2,
                  description: e.target.value,
                })
              }
              placeholder="e.g., Rondo 4v2 in 8 m square, two-touch limit. 3 × 4 min."
              className={inputClass("resize-none")}
            />
          </div>
          <div>
            <FieldLabel title="Organisation / Coaching" />
            <textarea
              rows={5}
              value={data.initial.phase2.coaching}
              onChange={(e) =>
                setInitial("phase2", {
                  ...data.initial.phase2,
                  coaching: e.target.value,
                })
              }
              placeholder="e.g., Defenders rotate after winning the ball. Cue: scan before receiving."
              className={inputClass("resize-none")}
            />
          </div>
        </div>
      </div>

      {/* Phase 3 */}
      <div className="mt-3 rounded-md border border-zinc-200 p-3">
        <SubsectionHeader
          title="Phase 3 — Explosivité"
          hint="Short bursts. Sprints, jumps, change of direction."
        />
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <FieldLabel title="Description" />
            <textarea
              rows={5}
              value={data.initial.phase3.description}
              onChange={(e) =>
                setInitial("phase3", {
                  ...data.initial.phase3,
                  description: e.target.value,
                })
              }
              placeholder="e.g., 4 × 10 m sprint with change of direction at the cone, 30 s rest. 3 sets."
              className={inputClass("resize-none")}
            />
          </div>
          <div>
            <FieldLabel title="Organisation / Coaching" />
            <textarea
              rows={5}
              value={data.initial.phase3.coaching}
              onChange={(e) =>
                setInitial("phase3", {
                  ...data.initial.phase3,
                  coaching: e.target.value,
                })
              }
              placeholder="e.g., Full intensity. Walk back recovery. Stay low through the change of direction."
              className={inputClass("resize-none")}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function PlaceholderSection({
  index,
  title,
  note,
}: {
  index: number;
  title: string;
  note: string;
}) {
  return (
    <Card>
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-bold text-zinc-400">
          {index}. {title}
        </h2>
        <span className="text-xs text-zinc-400">(coming next)</span>
      </div>
      <p className="mt-2 text-sm text-zinc-500">{note}</p>
    </Card>
  );
}

/* ============================================================
 * Container
 * ============================================================ */

function HowToUse() {
  const [open, setOpen] = useState(false);
  return (
    <div className="prep-no-print rounded-md border border-blue-200 bg-blue-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-blue-900"
      >
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          How this works
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t border-blue-200 px-3 py-3 text-sm text-blue-900">
          <p>
            Fill out the five sections below. When you click{" "}
            <strong>Export PDF</strong>, your text is laid into the official
            ASF preparation sheet — the layout, labels and pitches stay fixed.
          </p>
          <p className="mt-2 text-xs text-blue-800">
            Tip: use <strong>Load example</strong> to see a fully filled
            sheet first.
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
    <>
      {/* Web form (hidden when printing) */}
      <div className="prep-no-print flex flex-col gap-4">
        <HowToUse />

        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
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
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <GlobalSection data={data} patch={patch} />

        <InitialSection data={data} patch={patch} />

        <PlaceholderSection
          index={3}
          title="Exercice 1"
          note="First main exercise: forme jouée or exercice, with description, coaching, organisation and variations."
        />
        <PlaceholderSection
          index={4}
          title="Exercice 2"
          note="Second main exercise (same structure as Exercice 1)."
        />
        <PlaceholderSection
          index={5}
          title="Jeu final &amp; Fin"
          note="Match-style game, cooldown and post-session reflection."
        />
      </div>

      {/* PDF output (hidden on screen, shown only on print) */}
      <PdfExport data={data} />
    </>
  );
}

