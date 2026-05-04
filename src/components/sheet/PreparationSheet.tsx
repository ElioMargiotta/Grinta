"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Eye,
  FileText,
  Flag,
  Info,
  Layers,
  Printer,
  Save,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useLocale } from "next-intl";
import Image from "next/image";
import {
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Button } from "@/components/ui/Button";
import { savePreparationAction } from "@/app/[locale]/(app)/planner/[teamId]/sessions/[sessionId]/preparation/actions";
import { exampleSheet } from "./example";
import { SchemaEditor, SchemaView } from "./SchemaEditor";
import { type PreparationData, type SchemaData } from "./types";

/* ============================================================
 * PDF EXPORT VIEW   ⚠️  DO NOT MODIFY  ⚠️
 *   Two A4 pages with the SVG as fixed background, form text
 *   absolutely-positioned in mm. Hidden on screen, only visible
 *   when printing (see globals.css `.prep-export` rules).
 *   The export pipeline below — including all zone coordinates,
 *   helper components, and the PdfExport tree — is the contract
 *   the printed sheet depends on. Visual UX changes happen only
 *   in the WEB FORM section below.
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

function ExportSchema({ data, area }: { data: SchemaData; area: Box }) {
  return (
    <div style={box(area)} className="pointer-events-none overflow-hidden">
      <SchemaView data={data} />
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
      <Image
        src={bg}
        alt=""
        aria-hidden
        fill
        priority
        sizes="210mm"
        className="pointer-events-none select-none object-contain"
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
  phase1Schema: { x: 18, y: 101, w: 51, h: 37 },
  phase1Description: { x: 75, y: 99, w: 60, h: 33 },
  phase1Coaching: { x: 137, y: 99, w: 60, h: 33 },
  ankleDescription: { x: 96, y: 140, w: 45, h: 9 },
  ankleCoaching: { x: 137, y: 140, w: 60, h: 9 },
  kneeDescription: { x: 96, y: 152, w: 45, h: 9 },
  kneeCoaching: { x: 137, y: 152, w: 60, h: 9 },
  hipDescription: { x: 96, y: 164, w: 45, h: 9 },
  hipCoaching: { x: 137, y: 164, w: 60, h: 9 },
  hamstringDescription: { x: 96, y: 176, w: 45, h: 9 },
  hamstringCoaching: { x: 137, y: 176, w: 60, h: 9 },
  phase2Schema: { x: 18, y: 200, w: 51, h: 37 },
  phase2Description: { x: 75, y: 200, w: 60, h: 33 },
  phase2Coaching: { x: 137, y: 200, w: 60, h: 33 },
  phase3Description: { x: 75, y: 245, w: 60, h: 33 },
  phase3Coaching: { x: 138, y: 245, w: 60, h: 33 },
} as const;

const Z_MAIN_1 = {
  duration: { x: 151.5, y: 21.5, w: 39, h: 6 },
  schema: { x: 19.2, y: -1, w: 51, h: 100 },
  description: { x: 76, y: 33, w: 60, h: 41 },
  coaching: { x: 137.5, y: 33, w: 60, h: 41 },
  organisation: { x: 76, y: 85, w: 60, h: 20 },
  variations: { x: 137.5, y: 85, w: 60, h: 20 },
  playForm: { x: 14, y: 19.5, w: 4, h: 4 },
  exercise: { x: 41, y: 19.5, w: 4, h: 4 },
} as const;

const Z_MAIN_2 = {
  duration: { x: 151.5, y: 106.5, w: 39, h: 6 },
  schema: { x: 19.2, y: 84, w: 51, h: 100 },
  description: { x: 76, y: 119, w: 60, h: 41 },
  coaching: { x: 137.5, y: 119, w: 60, h: 41 },
  organisation: { x: 76, y: 170, w: 60, h: 20 },
  variations: { x: 137.5, y: 170, w: 60, h: 20 },
  playForm: { x: 14, y: 104.5, w: 4, h: 4 },
  exercise: { x: 41, y: 104.5, w: 4, h: 4 },
} as const;

const Z_END = {
  gameDuration: { x: 151.5, y: 191, w: 39, h: 6 },
  gameSchema: { x: 14.5, y: 198, w: 66, h: 37 },
  gameNotes: { x: 76, y: 196.5, w: 60, h: 35 },
  endDuration: { x: 151.5, y: 232, w: 39, h: 6 },
  endNotes: { x: 76, y: 238, w: 60, h: 18 },
  reflection: { x: 14, y: 268, w: 183, h: 18 },
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
        <ExportSchema
          data={data.initial.phase1.schema}
          area={Z_INITIAL.phase1Schema}
        />
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
        <ExportSchema
          data={data.initial.phase2.schema}
          area={Z_INITIAL.phase2Schema}
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
        <ExportSchema data={data.main[0].schema} area={Z_MAIN_1.schema} />
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
        <ExportSchema data={data.main[1].schema} area={Z_MAIN_2.schema} />
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
        <ExportSchema data={data.game.schema} area={Z_END.gameSchema} />
        <ExportText value={data.game.notes} area={Z_END.gameNotes} />
        <ExportText value={data.end.duration} area={Z_END.endDuration} />
        <ExportText value={data.end.notes} area={Z_END.endNotes} />
        <ExportText value={data.reflection} area={Z_END.reflection} />
      </ExportPage>
    </div>
  );
}

/* ============================================================
 * WEB FORM — premium wizard UI
 *   The five business sections are unchanged; only their
 *   presentation changed. Each step renders independently and
 *   reads/writes the same `PreparationData` shape consumed by
 *   `PdfExport` above.
 * ============================================================ */

/* ----- Form atoms ------------------------------------------- */

function FieldLabel({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-1.5">
      <div className="text-sm font-medium text-zinc-900">{title}</div>
      {hint && <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{hint}</div>}
    </div>
  );
}

function inputClass(extra = "") {
  return `w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 ${extra}`;
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

const NOOP_SUBSCRIBE = () => () => {};
const SERVER_FITS = () => true;

function useFits(text: string, widthMm: number, heightMm: number) {
  const getSnapshot = useCallback(
    () => fitsInExportBox(text, widthMm, heightMm),
    [text, widthMm, heightMm],
  );
  return useSyncExternalStore(NOOP_SUBSCRIBE, getSnapshot, SERVER_FITS);
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
          `resize-none ${fits ? "" : "border-red-300 focus:border-red-500 focus:ring-red-500/20"}`,
        )}
      />
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className={fits ? "text-zinc-400" : "text-red-600"}>
          {fits ? "Fits the printed page" : "Too long — will be clipped on the PDF"}
        </span>
        {maxChars !== undefined && (
          <span className="tabular-nums text-zinc-400">
            {value.length}/{maxChars}
          </span>
        )}
      </div>
    </div>
  );
}

/* ----- Step layout primitives ------------------------------- */

function StepHeader({
  eyebrow,
  title,
  description,
  durationField,
}: {
  eyebrow: string;
  title: string;
  description: string;
  durationField?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-100 pb-4">
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          {eyebrow}
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">{description}</p>
      </div>
      {durationField}
    </div>
  );
}

function DurationField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Durée
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-24 border-0 bg-transparent p-0 text-sm font-semibold text-zinc-900 focus:outline-none"
      />
    </label>
  );
}

function SubCard({
  icon,
  title,
  hint,
  children,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        {icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
          {hint && (
            <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{hint}</div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ----- Section: Global -------------------------------------- */

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
    <div className="flex flex-col gap-6">
      <StepHeader
        eyebrow="Step 1 of 5"
        title="Session brief"
        description="Set the date, team and the game moment(s) this session is built around."
      />

      {/* Date / Équipe / Entraîneur */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      <SubCard
        icon={<Flag className="h-4 w-4" />}
        title="Moments du jeu"
        hint="Tick the moment(s) of the game this session focuses on."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {phaseOptions.map(({ key, label, en }) => {
            const checked = data.phases[key];
            return (
              <label
                key={key}
                className={`group flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                  checked
                    ? "border-zinc-900 bg-zinc-900/[0.03] text-zinc-900 shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white"
                  }`}
                >
                  {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={(e) =>
                    patch((d) => ({
                      ...d,
                      phases: { ...d.phases, [key]: e.target.checked },
                    }))
                  }
                />
                <span className="min-w-0">
                  <span className="block font-medium leading-snug">{label}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{en}</span>
                </span>
              </label>
            );
          })}
        </div>
      </SubCard>

      {/* Long text fields */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <FieldLabel
            title="Forme caractéristique"
            hint="Situation de jeu — the real game situation this session is built around."
          />
          <textarea
            rows={3}
            maxLength={230}
            value={data.characteristicForm}
            onChange={(e) =>
              patch((d) => ({ ...d, characteristicForm: e.target.value }))
            }
            placeholder="e.g., Build-up from goalkeeper under high press"
            className={inputClass("resize-none")}
          />
          <div className="mt-1 text-right text-xs text-zinc-400 tabular-nums">
            {data.characteristicForm.length}/230
          </div>
        </div>
        <div>
          <FieldLabel
            title="Focus"
            hint="TE = Technique · TA = Tactique · PE = Physique · AT = Attitude"
          />
          <textarea
            rows={3}
            maxLength={115}
            value={data.focus}
            onChange={(e) =>
              patch((d) => ({ ...d, focus: e.target.value }))
            }
            placeholder="e.g., TA — pressing triggers"
            className={inputClass("resize-none")}
          />
          <div className="mt-1 text-right text-xs text-zinc-400 tabular-nums">
            {data.focus.length}/115
          </div>
        </div>
        <div>
          <FieldLabel
            title="Objectifs"
            hint="What players should be able to do by the end. Start with an action verb."
          />
          <textarea
            rows={3}
            maxLength={230}
            value={data.objectives}
            onChange={(e) =>
              patch((d) => ({ ...d, objectives: e.target.value }))
            }
            placeholder="e.g., Recognize the press trigger and play forward in 1–2 touches."
            className={inputClass("resize-none")}
          />
          <div className="mt-1 text-right text-xs text-zinc-400 tabular-nums">
            {data.objectives.length}/230
          </div>
        </div>
        <div>
          <FieldLabel
            title="Questions de développement"
            hint="Open questions you'll ask players to spark reflection."
          />
          <textarea
            rows={3}
            value={data.developmentQuestions}
            onChange={(e) =>
              patch((d) => ({ ...d, developmentQuestions: e.target.value }))
            }
            placeholder="e.g., When does the #6 drop between the center backs?"
            className={inputClass("resize-none")}
          />
        </div>
      </div>
    </div>
  );
}

/* ----- Section: Initial ------------------------------------- */

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

  function setPhase2<K extends keyof PreparationData["initial"]["phase2"]>(
    key: K,
    value: PreparationData["initial"]["phase2"][K],
  ) {
    patch((d) => ({
      ...d,
      initial: {
        ...d.initial,
        phase2: { ...d.initial.phase2, [key]: value },
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
    <div className="flex flex-col gap-6">
      <StepHeader
        eyebrow="Step 2 of 5"
        title="Warm-up & preparation"
        description="Mobility, technical/tactical work, then a short explosive block."
        durationField={
          <DurationField
            value={data.initial.duration}
            onChange={(v) => setInitial("duration", v)}
            placeholder="25 min"
          />
        }
      />

      <SubCard
        title="Phase 1 — Échauffement"
        hint="Loose warmup. Mobility, ball touches."
      >
        <div>
          <FieldLabel
            title="Schéma sur le terrain"
            hint="Pose les joueurs, ballon et plots — clique-glisse pour tracer une course, une passe ou une conduite."
          />
          <SchemaEditor
            value={data.initial.phase1.schema}
            onChange={(v) => setPhase1("schema", v)}
          />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
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

        {/* Prévention */}
        <div className="mt-5 rounded-lg bg-zinc-50 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                Stabilité corporelle (Prévention)
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                Optional injury-prevention block. ~25 s per body part.
              </div>
            </div>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-600 shadow-sm ring-1 ring-zinc-200">
              25″ / rep
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {preventionRows.map(({ key, label, en }) => (
              <div
                key={key}
                className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr_1fr] md:items-start"
              >
                <div className="pt-1.5 text-sm font-semibold text-zinc-800">
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
        </div>
      </SubCard>

      <SubCard
        title="Phase 2 — Échauffement (TE/TA/PE)"
        hint="Technical / tactical / physical warmup that builds toward the main session."
      >
        <div>
          <FieldLabel
            title="Schéma sur le terrain"
            hint="Pose les joueurs, ballon et plots — clique-glisse pour tracer une course, une passe ou une conduite."
          />
          <SchemaEditor
            value={data.initial.phase2.schema}
            onChange={(v) => setPhase2("schema", v)}
          />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <FieldLabel title="Description" hint="What players do" />
            <FitTextarea
              rows={5}
              maxChars={420}
              area={{
                w: Z_INITIAL.phase2Description.w,
                h: Z_INITIAL.phase2Description.h,
              }}
              value={data.initial.phase2.description}
              onChange={(v) => setPhase2("description", v)}
              placeholder="e.g., Rondo 4v2 in 8 m square, two-touch limit. 3 × 4 min."
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
                w: Z_INITIAL.phase2Coaching.w,
                h: Z_INITIAL.phase2Coaching.h,
              }}
              value={data.initial.phase2.coaching}
              onChange={(v) => setPhase2("coaching", v)}
              placeholder="e.g., Defenders rotate after winning the ball. Cue: scan before receiving."
            />
          </div>
        </div>
      </SubCard>

      <SubCard
        title="Phase 3 — Explosivité"
        hint="Short bursts. Sprints, jumps, change of direction."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
      </SubCard>
    </div>
  );
}

/* ----- Section: Main exercise ------------------------------- */

type MainZones = {
  duration: Box;
  schema: Box;
  description: Box;
  coaching: Box;
  organisation: Box;
  variations: Box;
  playForm: Box;
  exercise: Box;
};

function MainExerciseSection({
  slot,
  stepLabel,
  data,
  patch,
  zones,
}: {
  slot: 0 | 1;
  stepLabel: string;
  data: PreparationData;
  patch: (updater: (d: PreparationData) => PreparationData) => void;
  zones: MainZones;
}) {
  const exercise = data.main[slot];

  function setExercise<K extends keyof PreparationData["main"][number]>(
    key: K,
    value: PreparationData["main"][number][K],
  ) {
    patch((d) => ({
      ...d,
      main: d.main.map((m, i) =>
        i === slot ? { ...m, [key]: value } : m,
      ) as PreparationData["main"],
    }));
  }

  const typeOptions = [
    { value: "playForm" as const, label: "Forme jouée", en: "Play form" },
    { value: "exercise" as const, label: "Exercice", en: "Exercise" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        eyebrow={stepLabel}
        title={`Main block ${slot + 1}`}
        description="Forme jouée or exercice — your central training block."
        durationField={
          <DurationField
            value={exercise.duration}
            onChange={(v) => setExercise("duration", v)}
            placeholder="20 min"
          />
        }
      />

      <SubCard
        title="Type"
        hint="Forme jouée = game-like situation. Exercice = analytic drill."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {typeOptions.map(({ value, label, en }) => {
            const active = exercise.type === value;
            return (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                  active
                    ? "border-zinc-900 bg-zinc-900/[0.03] text-zinc-900 shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    active
                      ? "border-zinc-900"
                      : "border-zinc-300"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full transition ${
                      active ? "bg-zinc-900" : "bg-transparent"
                    }`}
                  />
                </span>
                <input
                  type="radio"
                  name={`main-${slot}-type`}
                  className="sr-only"
                  checked={active}
                  onChange={() => setExercise("type", value)}
                />
                <span className="min-w-0">
                  <span className="block font-medium leading-snug">{label}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{en}</span>
                </span>
              </label>
            );
          })}
        </div>
      </SubCard>

      <SubCard
        title="Schéma sur le terrain"
        hint="Terrain complet — pose les joueurs, ballon et plots, puis trace courses, passes et conduites."
      >
        <SchemaEditor
          pitch="full-vertical"
          value={exercise.schema}
          onChange={(v) => setExercise("schema", v)}
        />
      </SubCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SubCard title="Description" hint="What players do">
          <FitTextarea
            rows={6}
            maxChars={520}
            area={{ w: zones.description.w, h: zones.description.h }}
            value={exercise.description}
            onChange={(v) => setExercise("description", v)}
            placeholder="e.g., Build-up exercise: GK + back four + #6 vs 3 high-pressing strikers. Score by playing through the half-line gate."
          />
        </SubCard>
        <SubCard title="Coaching" hint="Cues and corrections">
          <FitTextarea
            rows={6}
            maxChars={520}
            area={{ w: zones.coaching.w, h: zones.coaching.h }}
            value={exercise.coaching}
            onChange={(v) => setExercise("coaching", v)}
            placeholder="e.g., Trigger = back-pass to GK. Cue body shape on first touch. Reward forward passes through the gate."
          />
        </SubCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SubCard title="Organisation" hint="Setup, dimensions, equipment.">
          <FitTextarea
            rows={4}
            maxChars={300}
            area={{ w: zones.organisation.w, h: zones.organisation.h }}
            value={exercise.organisation}
            onChange={(v) => setExercise("organisation", v)}
            placeholder="e.g., Half-pitch. 3 yellow gates on the half-line. 3 mannequins as outlet markers behind."
          />
        </SubCard>
        <SubCard title="Variations" hint="Make it harder (+) or easier (−).">
          <FitTextarea
            rows={4}
            maxChars={300}
            area={{ w: zones.variations.w, h: zones.variations.h }}
            value={exercise.variations}
            onChange={(v) => setExercise("variations", v)}
            placeholder="e.g., + add a #10 between the lines. − reduce gate count to 2; longer rest."
          />
        </SubCard>
      </div>
    </div>
  );
}

/* ----- Section: Final game / End ---------------------------- */

function EndSection({
  data,
  patch,
}: {
  data: PreparationData;
  patch: (updater: (d: PreparationData) => PreparationData) => void;
}) {
  function setGame<K extends keyof PreparationData["game"]>(
    key: K,
    value: PreparationData["game"][K],
  ) {
    patch((d) => ({ ...d, game: { ...d.game, [key]: value } }));
  }
  function setEnd<K extends keyof PreparationData["end"]>(
    key: K,
    value: PreparationData["end"][K],
  ) {
    patch((d) => ({ ...d, end: { ...d.end, [key]: value } }));
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        eyebrow="Step 5 of 5"
        title="Final game & wrap-up"
        description="Match-style game, cool-down and a short post-session reflection."
      />

      <SubCard
        title="Jeu final"
        hint="Free or themed match — apply what was worked on."
      >
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <DurationField
            value={data.game.duration}
            onChange={(v) => setGame("duration", v)}
            placeholder="15 min"
          />
        </div>
        <div>
          <FieldLabel
            title="Schéma sur le terrain"
            hint="Terrain complet horizontal — pose les équipes et trace le scénario."
          />
          <SchemaEditor
            pitch="full-horizontal"
            value={data.game.schema}
            onChange={(v) => setGame("schema", v)}
          />
        </div>
        <div className="mt-5">
          <FieldLabel
            title="Notes"
            hint="Format, contraintes, points de coaching."
          />
          <FitTextarea
            rows={4}
            maxChars={360}
            area={{ w: Z_END.gameNotes.w, h: Z_END.gameNotes.h }}
            value={data.game.notes}
            onChange={(v) => setGame("notes", v)}
            placeholder="e.g., 11v11 free play on full pitch. Last 15 minutes. Normal rules."
          />
        </div>
      </SubCard>

      <SubCard
        title="Fin de séance"
        hint="Cooldown, breathing, quick verbal debrief."
      >
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <DurationField
            value={data.end.duration}
            onChange={(v) => setEnd("duration", v)}
            placeholder="5 min"
          />
        </div>
        <FieldLabel title="Notes" />
        <FitTextarea
          rows={3}
          maxChars={360}
          area={{ w: Z_END.endNotes.w, h: Z_END.endNotes.h }}
          value={data.end.notes}
          onChange={(v) => setEnd("notes", v)}
          placeholder="e.g., Walk to center circle. 60s breathing. Quick verbal debrief."
        />
      </SubCard>

      <SubCard
        title="Réflexion"
        hint="Personal notes after the session — what worked, what didn't."
      >
        <FitTextarea
          rows={3}
          maxChars={360}
          area={{ w: Z_END.reflection.w, h: Z_END.reflection.h }}
          value={data.reflection}
          onChange={(v) => patch((d) => ({ ...d, reflection: v }))}
          placeholder="What worked, what didn't, who needs more individual work next week."
        />
      </SubCard>
    </div>
  );
}

/* ----- Step: Review ----------------------------------------- */

function ReviewRow({ label, value }: { label: string; value: string }) {
  const empty = !value || value.trim() === "";
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2.5 last:border-b-0">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={`max-w-[60%] truncate text-right text-sm ${
          empty ? "text-zinc-400" : "text-zinc-900"
        }`}
      >
        {empty ? "—" : value}
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  status,
  onEdit,
  children,
}: {
  title: string;
  status: SectionStatus;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
        >
          Edit
        </button>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: SectionStatus }) {
  if (status === "complete") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
    </span>
  );
}

function ReviewStep({
  data,
  statuses,
  onJumpTo,
  onExport,
}: {
  data: PreparationData;
  statuses: SectionStatus[];
  onJumpTo: (index: number) => void;
  onExport: () => void;
}) {
  const phaseLabels: Array<[keyof PreparationData["phases"], string]> = [
    ["possession", "Possession"],
    ["losing", "Losing"],
    ["noPossession", "Out of possession"],
    ["recovering", "Recovering"],
  ];
  const activePhases = phaseLabels
    .filter(([k]) => data.phases[k])
    .map(([, l]) => l)
    .join(", ");

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        eyebrow="Final review"
        title="Review & export"
        description="Quick check of every section before generating the printed sheet."
      />

      <div className="rounded-xl border border-zinc-900 bg-zinc-900 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
              <Sparkles className="h-3.5 w-3.5" /> Ready to print
            </div>
            <div className="mt-1 text-lg font-semibold">
              ASF preparation sheet — {data.team || "your team"}
            </div>
            <div className="mt-0.5 text-sm text-zinc-300">
              {data.date || "No date"} · Coach {data.coach || "—"}
            </div>
          </div>
          <Button variant="secondary" onClick={onExport}>
            <Printer className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReviewSection
          title="1 · Session brief"
          status={statuses[0]}
          onEdit={() => onJumpTo(0)}
        >
          <ReviewRow label="Date" value={data.date} />
          <ReviewRow label="Team" value={data.team} />
          <ReviewRow label="Coach" value={data.coach} />
          <ReviewRow label="Game moments" value={activePhases} />
          <ReviewRow label="Forme caractéristique" value={data.characteristicForm} />
          <ReviewRow label="Focus" value={data.focus} />
          <ReviewRow label="Objectifs" value={data.objectives} />
        </ReviewSection>

        <ReviewSection
          title="2 · Warm-up & preparation"
          status={statuses[1]}
          onEdit={() => onJumpTo(1)}
        >
          <ReviewRow label="Durée" value={data.initial.duration} />
          <ReviewRow label="Phase 1" value={data.initial.phase1.description} />
          <ReviewRow label="Phase 2" value={data.initial.phase2.description} />
          <ReviewRow label="Phase 3" value={data.initial.phase3.description} />
        </ReviewSection>

        <ReviewSection
          title="3 · Main block 1"
          status={statuses[2]}
          onEdit={() => onJumpTo(2)}
        >
          <ReviewRow
            label="Type"
            value={data.main[0].type === "playForm" ? "Forme jouée" : "Exercice"}
          />
          <ReviewRow label="Durée" value={data.main[0].duration} />
          <ReviewRow label="Description" value={data.main[0].description} />
        </ReviewSection>

        <ReviewSection
          title="4 · Main block 2"
          status={statuses[3]}
          onEdit={() => onJumpTo(3)}
        >
          <ReviewRow
            label="Type"
            value={data.main[1].type === "playForm" ? "Forme jouée" : "Exercice"}
          />
          <ReviewRow label="Durée" value={data.main[1].duration} />
          <ReviewRow label="Description" value={data.main[1].description} />
        </ReviewSection>

        <ReviewSection
          title="5 · Final game & wrap-up"
          status={statuses[4]}
          onEdit={() => onJumpTo(4)}
        >
          <ReviewRow label="Game · Durée" value={data.game.duration} />
          <ReviewRow label="Game · Notes" value={data.game.notes} />
          <ReviewRow label="End · Durée" value={data.end.duration} />
          <ReviewRow label="End · Notes" value={data.end.notes} />
          <ReviewRow label="Réflexion" value={data.reflection} />
        </ReviewSection>
      </div>
    </div>
  );
}

/* ============================================================
 * Wizard shell
 * ============================================================ */

type SectionStatus = "empty" | "partial" | "complete";

const STEP_DEFS = [
  { key: "global", label: "Session brief", icon: Info },
  { key: "initial", label: "Warm-up & prep", icon: Layers },
  { key: "main1", label: "Main block 1", icon: Target },
  { key: "main2", label: "Main block 2", icon: Target },
  { key: "end", label: "Final game & wrap-up", icon: Trophy },
  { key: "review", label: "Review & export", icon: Eye },
] as const;

function computeStatuses(data: PreparationData): SectionStatus[] {
  const phasesAny =
    data.phases.possession ||
    data.phases.losing ||
    data.phases.noPossession ||
    data.phases.recovering;

  const globalFields = [
    data.date.trim(),
    data.team.trim(),
    data.coach.trim(),
    phasesAny ? "1" : "",
    data.characteristicForm.trim(),
    data.focus.trim(),
    data.objectives.trim(),
  ];
  const globalFilled = globalFields.filter(Boolean).length;
  const globalStatus: SectionStatus =
    globalFilled === 0 ? "empty" : globalFilled === globalFields.length ? "complete" : "partial";

  const initialFields = [
    data.initial.duration.trim(),
    data.initial.phase1.description.trim(),
    data.initial.phase1.coaching.trim(),
    data.initial.phase2.description.trim(),
    data.initial.phase2.coaching.trim(),
    data.initial.phase3.description.trim(),
  ];
  const initialFilled = initialFields.filter(Boolean).length;
  const initialStatus: SectionStatus =
    initialFilled === 0 ? "empty" : initialFilled >= 4 ? "complete" : "partial";

  function mainStatus(slot: 0 | 1): SectionStatus {
    const m = data.main[slot];
    const fields = [
      m.duration.trim(),
      m.description.trim(),
      m.coaching.trim(),
      m.organisation.trim(),
    ];
    const filled = fields.filter(Boolean).length;
    return filled === 0 ? "empty" : filled >= 3 ? "complete" : "partial";
  }

  const endFields = [
    data.game.duration.trim(),
    data.game.notes.trim(),
    data.end.duration.trim(),
    data.end.notes.trim(),
  ];
  const endFilled = endFields.filter(Boolean).length;
  const endStatus: SectionStatus =
    endFilled === 0 ? "empty" : endFilled >= 3 ? "complete" : "partial";

  return [globalStatus, initialStatus, mainStatus(0), mainStatus(1), endStatus];
}

function StepperNav({
  currentIndex,
  onSelect,
  statuses,
}: {
  currentIndex: number;
  onSelect: (index: number) => void;
  statuses: SectionStatus[];
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Preparation steps">
      {STEP_DEFS.map((step, index) => {
        const Icon = step.icon;
        const active = index === currentIndex;
        const isReview = step.key === "review";
        const status: SectionStatus = isReview ? "empty" : statuses[index];

        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onSelect(index)}
            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
              active
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${
                active
                  ? "bg-white/15 text-white"
                  : status === "complete"
                    ? "bg-emerald-500 text-white"
                    : status === "partial"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200"
              }`}
            >
              {!active && status === "complete" ? (
                <Check className="h-4 w-4" strokeWidth={3} />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block text-[10px] font-medium uppercase tracking-wider ${
                  active ? "text-zinc-300" : "text-zinc-400"
                }`}
              >
                {isReview ? "Final" : `Step ${index + 1}`}
              </span>
              <span className="block truncate text-sm font-medium">
                {step.label}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function MobileStepBar({
  currentIndex,
  onSelect,
  statuses,
}: {
  currentIndex: number;
  onSelect: (index: number) => void;
  statuses: SectionStatus[];
}) {
  return (
    <div className="lg:hidden">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {STEP_DEFS.map((step, index) => {
          const active = index === currentIndex;
          const isReview = step.key === "review";
          const status: SectionStatus = isReview ? "empty" : statuses[index];
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onSelect(index)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold ${
                  active
                    ? "bg-white/15 text-white"
                    : status === "complete"
                      ? "bg-emerald-500 text-white"
                      : status === "partial"
                        ? "bg-amber-200 text-amber-800"
                        : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {!active && status === "complete" ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </span>
              {isReview ? "Review" : step.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProgressBar({ statuses }: { statuses: SectionStatus[] }) {
  const score = statuses.reduce(
    (s, st) => s + (st === "complete" ? 1 : st === "partial" ? 0.5 : 0),
    0,
  );
  const pct = Math.round((score / statuses.length) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-1.5 w-32 overflow-hidden rounded-full bg-zinc-200">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums text-zinc-600">
        {pct}% complete
      </span>
    </div>
  );
}

/* ============================================================
 * Container
 * ============================================================ */

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
  const [stepIndex, setStepIndex] = useState(0);
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

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  const statuses = useMemo(() => computeStatuses(data), [data]);
  const isReview = stepIndex === STEP_DEFS.length - 1;

  function goPrev() {
    setStepIndex((i) => Math.max(0, i - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goNext() {
    setStepIndex((i) => Math.min(STEP_DEFS.length - 1, i + 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function jumpTo(i: number) {
    setStepIndex(i);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  let stepBody: ReactNode;
  switch (stepIndex) {
    case 0:
      stepBody = <GlobalSection data={data} patch={patch} />;
      break;
    case 1:
      stepBody = <InitialSection data={data} patch={patch} />;
      break;
    case 2:
      stepBody = (
        <MainExerciseSection
          slot={0}
          stepLabel="Step 3 of 5"
          data={data}
          patch={patch}
          zones={Z_MAIN_1}
        />
      );
      break;
    case 3:
      stepBody = (
        <MainExerciseSection
          slot={1}
          stepLabel="Step 4 of 5"
          data={data}
          patch={patch}
          zones={Z_MAIN_2}
        />
      );
      break;
    case 4:
      stepBody = <EndSection data={data} patch={patch} />;
      break;
    default:
      stepBody = (
        <ReviewStep
          data={data}
          statuses={statuses}
          onJumpTo={jumpTo}
          onExport={handlePrint}
        />
      );
  }

  const statusLine = dirty
    ? savedAt
      ? `Unsaved changes · last saved ${savedAt}`
      : "Unsaved changes"
    : savedAt
      ? `All changes saved at ${savedAt}`
      : "Not saved yet";

  return (
    <>
      <div className="prep-no-print">
        {/* Sticky toolbar */}
        <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    dirty
                      ? "bg-amber-500"
                      : savedAt
                        ? "bg-emerald-500"
                        : "bg-zinc-300"
                  }`}
                />
                <span className="text-sm text-zinc-600">{statusLine}</span>
              </div>
              <div className="hidden md:block">
                <ProgressBar statuses={statuses} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={loadExample}>
                <FileText className="h-4 w-4" />
                Load example
              </Button>
              <Button variant="secondary" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                Export PDF
              </Button>
              <Button size="sm" disabled={isPending} onClick={save}>
                <Save className="h-4 w-4" />
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
          <div className="mt-3 md:hidden">
            <ProgressBar statuses={statuses} />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Mobile stepper */}
        <div className="mb-4 lg:hidden">
          <MobileStepBar
            currentIndex={stepIndex}
            onSelect={jumpTo}
            statuses={statuses}
          />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          {/* Sidebar stepper (desktop) */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <div className="sticky top-24">
              <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                <div className="px-2 pb-2 pt-1">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Preparation flow
                  </div>
                </div>
                <StepperNav
                  currentIndex={stepIndex}
                  onSelect={jumpTo}
                  statuses={statuses}
                />
              </div>
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600">
                Fill out each step. When you click <strong>Export PDF</strong>,
                your text is laid into the official ASF preparation sheet —
                layout, labels and pitches stay fixed.
              </div>
            </div>
          </aside>

          {/* Step content */}
          <div className="min-w-0 flex-1">
            <div
              key={stepIndex}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm motion-safe:animate-[prep-step-in_180ms_ease-out] sm:p-8"
            >
              {stepBody}
            </div>

            {/* Step footer */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={goPrev}
                disabled={stepIndex === 0}
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                {!isReview ? (
                  <Button size="sm" onClick={goNext}>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" disabled={isPending} onClick={save}>
                      <Save className="h-4 w-4" />
                      {isPending ? "Saving…" : "Save draft"}
                    </Button>
                    <Button size="sm" onClick={handlePrint}>
                      <Printer className="h-4 w-4" />
                      Generate PDF
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF output (hidden on screen, shown only on print) */}
      <PdfExport data={data} />
    </>
  );
}
