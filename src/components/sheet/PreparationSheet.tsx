"use client";

import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flag,
  Loader2,
  Printer,
  Save,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { savePreparationAction } from "@/app/[locale]/(app)/planner/[teamId]/sessions/[sessionId]/preparation/actions";
import { exampleSheet } from "./example";
import {
  ExerciseLibraryPicker,
  buildMainBlockFromLibrary,
  type LibraryExercise,
} from "./ExerciseLibraryPicker";
import { SchemaEditor, SchemaView } from "./SchemaEditor";
import {
  FOCUS_FAMILIES,
  type FocusFamily,
  type PreparationData,
  type SchemaData,
} from "./types";

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

function ExportSchema({
  data,
  area,
  settingsKey,
}: {
  data: SchemaData;
  area: Box;
  settingsKey: "warmup" | "block" | "game";
}) {
  return (
    <div style={box(area)} className="pointer-events-none overflow-hidden">
      <SchemaView data={data} settingsKey={settingsKey} />
    </div>
  );
}

function ExportImage({ src, area }: { src: string; area: Box }) {
  return (
    <div
      style={box(area)}
      className="pointer-events-none flex items-center justify-center overflow-hidden bg-white"
    >
      {/* Plain <img> so the printed PDF embeds the bitmap directly without
       * Next/Image's runtime layout (which doesn't run in the print view). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function ExportMainSchema({
  imageUrl,
  schema,
  area,
  imageArea,
}: {
  imageUrl: string | undefined;
  schema: SchemaData;
  area: Box;
  imageArea: Box;
}) {
  if (imageUrl) return <ExportImage src={imageUrl} area={imageArea} />;
  return <ExportSchema data={schema} area={area} settingsKey="block" />;
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
  image: { x: 19.2, y: 30, w: 51, h: 73 },
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
  image: { x: 19.2, y: 115, w: 51, h: 73 },
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
          settingsKey="warmup"
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
          settingsKey="warmup"
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
        <ExportMainSchema
          imageUrl={data.main[0].imageUrl}
          schema={data.main[0].schema}
          area={Z_MAIN_1.schema}
          imageArea={Z_MAIN_1.image}
        />
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
        <ExportMainSchema
          imageUrl={data.main[1].imageUrl}
          schema={data.main[1].schema}
          area={Z_MAIN_2.schema}
          imageArea={Z_MAIN_2.image}
        />
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
        <ExportSchema
          data={data.game.schema}
          area={Z_END.gameSchema}
          settingsKey="game"
        />
        <ExportText value={data.game.notes} area={Z_END.gameNotes} />
        <ExportText value={data.end.duration} area={Z_END.endDuration} />
        <ExportText value={data.end.notes} area={Z_END.endNotes} />
        <ExportText value={data.reflection} area={Z_END.reflection} />
      </ExportPage>
    </div>
  );
}

/* ============================================================
 * WEB FORM — premium full-screen wizard
 *   Dark sidebar + frosted topbar + light content panel.
 *   The whole shell is viewport-locked: the page itself never
 *   scrolls, only the active step's body does. The five business
 *   sections are unchanged; only their presentation. Each step
 *   reads/writes the same `PreparationData` shape consumed by
 *   `PdfExport` above.
 * ============================================================ */

/* ----- Form atoms ------------------------------------------- */

function Field({
  label,
  hint,
  charMax,
  charVal,
  children,
}: {
  label: string;
  hint?: string;
  charMax?: number;
  charVal?: number;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[12px] font-medium text-zinc-700">{label}</div>
      {hint && (
        <div className="-mt-0.5 text-[11px] leading-snug text-zinc-400">
          {hint}
        </div>
      )}
      {children}
      {charMax !== undefined && (
        <div className="text-right text-[10px] tabular-nums text-zinc-400">
          {charVal ?? 0}/{charMax}
        </div>
      )}
    </div>
  );
}

const inpClass =
  "h-9 w-full rounded-[9px] border-[1.5px] border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.04)] outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:shadow-[0_0_0_3px_rgb(12_12_13/0.07)]";
const txtaClass =
  "w-full resize-none rounded-[9px] border-[1.5px] border-zinc-200 bg-white px-3 py-2.5 text-[13px] leading-[1.55] text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.04)] outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:shadow-[0_0_0_3px_rgb(12_12_13/0.07)]";

function DurPill({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-[9px] border-[1.5px] border-zinc-200 bg-white px-3 py-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
        Durée
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "— min"}
        className="w-16 border-0 bg-transparent p-0 text-[13px] font-semibold text-zinc-900 outline-none"
      />
    </label>
  );
}

function CheckCard({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full select-none items-start gap-2.5 rounded-[10px] border-[1.5px] px-3 py-2.5 text-left transition ${
        checked
          ? "border-zinc-900 bg-[#0c0c0d]/[0.025]"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      <span
        className={`mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition ${
          checked
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-300 bg-white"
        }`}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium leading-snug text-zinc-900">
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[11px] text-zinc-400">{hint}</span>
        )}
      </span>
    </button>
  );
}

function RadioCard({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center gap-2.5 rounded-[10px] border-[1.5px] px-3 py-2.5 text-left transition ${
        active
          ? "border-zinc-900 bg-[#0c0c0d]/[0.025]"
          : "border-zinc-200 bg-white hover:border-zinc-300"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition ${
          active ? "border-zinc-900" : "border-zinc-300"
        }`}
      >
        {active && <span className="h-2 w-2 rounded-full bg-zinc-900" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-zinc-900">
          {label}
        </span>
        {hint && (
          <span className="block text-[11px] text-zinc-400">{hint}</span>
        )}
      </span>
    </button>
  );
}

const FOCUS_FAMILY_LABELS: Record<FocusFamily, string> = {
  TE: "Technique",
  TA: "Tactique",
  PE: "Forme physique",
  AT: "Mentalité",
};

function FocusFamilyChips({
  value,
  onChange,
}: {
  value: FocusFamily[];
  onChange: (next: FocusFamily[]) => void;
}) {
  function toggle(f: FocusFamily) {
    if (value.includes(f)) onChange(value.filter((x) => x !== f));
    else onChange([...value, f]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {FOCUS_FAMILIES.map((f) => {
        const active = value.includes(f);
        return (
          <button
            key={f}
            type="button"
            onClick={() => toggle(f)}
            className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-medium transition ${
              active
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
            }`}
          >
            <span className="font-mono text-[10px] tabular-nums opacity-70">
              {f}
            </span>
            <span>{FOCUS_FAMILY_LABELS[f]}</span>
          </button>
        );
      })}
    </div>
  );
}

function Card({
  icon,
  title,
  hint,
  rightAction,
  children,
}: {
  icon?: ReactNode;
  title?: string;
  hint?: string;
  rightAction?: ReactNode;
  children: ReactNode;
}) {
  const hasHeader = !!(icon || title || hint || rightAction);
  return (
    <div className="overflow-hidden rounded-[12px] border border-zinc-200 bg-white shadow-[0_1px_3px_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.04)]">
      {hasHeader && (
        <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3">
          {icon && (
            <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-[#0c0c0d] text-white">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <div className="text-[12px] font-semibold text-zinc-900">
                {title}
              </div>
            )}
            {hint && (
              <div className="mt-0.5 text-[11px] text-zinc-400">{hint}</div>
            )}
          </div>
          {rightAction}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
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
  rows = 4,
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
    <div className="flex flex-col gap-1">
      <textarea
        rows={rows}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${txtaClass} ${fits ? "" : "border-red-300 focus:border-red-500 focus:shadow-[0_0_0_3px_rgb(239_68_68/0.12)]"}`}
      />
      <div className="flex items-center justify-between text-[10px]">
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

/* ----- Status helpers -------------------------------------- */

type SectionStatus = "empty" | "partial" | "complete";

function StatusDot({
  status,
  dark,
}: {
  status: SectionStatus;
  dark?: boolean;
}) {
  const c =
    status === "complete"
      ? "#22c55e"
      : status === "partial"
        ? "#f59e0b"
        : dark
          ? "rgba(255,255,255,0.2)"
          : "#e5e7eb";
  return (
    <span
      className="block h-[7px] w-[7px] shrink-0 rounded-full"
      style={{ background: c }}
    />
  );
}

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
    globalFilled === 0
      ? "empty"
      : globalFilled === globalFields.length
        ? "complete"
        : "partial";

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
    initialFilled === 0
      ? "empty"
      : initialFilled >= 4
        ? "complete"
        : "partial";

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

/* ============================================================
 * STEPS
 * ============================================================ */

type Patcher = (updater: (d: PreparationData) => PreparationData) => void;

/* Step 1 — Session brief */
function Step1({ data, patch }: { data: PreparationData; patch: Patcher }) {
  const phaseOptions = [
    { key: "possession" as const, label: "We have the ball", fr: "Mon équipe possède" },
    { key: "losing" as const, label: "We just lost the ball", fr: "Mon équipe perd" },
    { key: "noPossession" as const, label: "They have the ball", fr: "Sans possession" },
    { key: "recovering" as const, label: "We win the ball back", fr: "Récupération" },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Date">
          <input
            type="date"
            className={inpClass}
            value={data.date}
            onChange={(e) => patch((d) => ({ ...d, date: e.target.value }))}
          />
        </Field>
        <Field label="Équipe" hint="Team">
          <input
            className={inpClass}
            placeholder="U15 Élite"
            value={data.team}
            onChange={(e) => patch((d) => ({ ...d, team: e.target.value }))}
          />
        </Field>
        <Field label="Entraîneur" hint="Coach">
          <input
            className={inpClass}
            placeholder="Your name"
            value={data.coach}
            onChange={(e) => patch((d) => ({ ...d, coach: e.target.value }))}
          />
        </Field>
      </div>

      <Card
        icon={<Flag className="h-3.5 w-3.5" strokeWidth={2} />}
        title="Moments du jeu"
        hint="Tick the game moment(s) this session is built around"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {phaseOptions.map((ph) => (
            <CheckCard
              key={ph.key}
              label={ph.label}
              hint={ph.fr}
              checked={data.phases[ph.key]}
              onChange={(v) =>
                patch((d) => ({
                  ...d,
                  phases: { ...d.phases, [ph.key]: v },
                }))
              }
            />
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Field
          label="Forme caractéristique"
          hint="The game situation this session is built around"
          charMax={230}
          charVal={data.characteristicForm.length}
        >
          <textarea
            rows={3}
            maxLength={230}
            className={txtaClass}
            placeholder="e.g., Build-up from GK under high press"
            value={data.characteristicForm}
            onChange={(e) =>
              patch((d) => ({ ...d, characteristicForm: e.target.value }))
            }
          />
        </Field>
        <Field
          label="Focus"
          hint="Select coaching families · note details below"
          charMax={115}
          charVal={data.focus.length}
        >
          <div className="flex flex-col gap-2">
            <FocusFamilyChips
              value={data.focusFamilies}
              onChange={(v) => patch((d) => ({ ...d, focusFamilies: v }))}
            />
            <textarea
              rows={2}
              maxLength={115}
              className={txtaClass}
              placeholder="e.g., TA — pressing triggers"
              value={data.focus}
              onChange={(e) => patch((d) => ({ ...d, focus: e.target.value }))}
            />
          </div>
        </Field>
        <Field
          label="Objectifs"
          hint="What players should do by the end"
          charMax={230}
          charVal={data.objectives.length}
        >
          <textarea
            rows={3}
            maxLength={230}
            className={txtaClass}
            placeholder="e.g., Recognize press trigger, play forward in 1–2 touches"
            value={data.objectives}
            onChange={(e) =>
              patch((d) => ({ ...d, objectives: e.target.value }))
            }
          />
        </Field>
        <Field
          label="Questions de développement"
          hint="Open questions to spark player reflection"
        >
          <textarea
            rows={3}
            className={txtaClass}
            placeholder="e.g., When does the #6 drop between the center backs?"
            value={data.developmentQuestions}
            onChange={(e) =>
              patch((d) => ({ ...d, developmentQuestions: e.target.value }))
            }
          />
        </Field>
      </div>
    </div>
  );
}

/* Step 2 — Warm-up & prep (tabbed phases) */
function Step2({ data, patch }: { data: PreparationData; patch: Patcher }) {
  const [tab, setTab] = useState<"p1" | "p2" | "p3">("p1");
  const pv = data.initial.phase1.prevention;
  const prevRows = [
    { k: "ankle" as const, l: "Ankle / Cheville" },
    { k: "knee" as const, l: "Knee / Genou" },
    { k: "hip" as const, l: "Hip / Hanche" },
    { k: "hamstring" as const, l: "Hamstrings" },
  ];
  const tabs: Array<["p1" | "p2" | "p3", string]> = [
    ["p1", "Phase 1 — Warmup"],
    ["p2", "Phase 2 — TE/TA/PE"],
    ["p3", "Phase 3 — Explosivité"],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3.5">
        <DurPill
          value={data.initial.duration}
          onChange={(v) =>
            patch((d) => ({ ...d, initial: { ...d.initial, duration: v } }))
          }
          placeholder="25 min"
        />
        <div className="flex gap-1 rounded-[9px] bg-zinc-100 p-[3px]">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex h-7 items-center whitespace-nowrap rounded-[7px] px-3 text-[12px] font-medium transition ${
                tab === id
                  ? "bg-white text-zinc-900 shadow-[0_1px_3px_rgb(0_0_0/0.1)]"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "p1" && (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[2fr_3fr]">
          <Field label="Schéma terrain">
            <SchemaEditor
              settingsKey="warmup"
              value={data.initial.phase1.schema}
              onChange={(v) =>
                patch((d) => ({
                  ...d,
                  initial: {
                    ...d.initial,
                    phase1: { ...d.initial.phase1, schema: v },
                  },
                }))
              }
            />
          </Field>
          <div className="flex flex-col gap-2.5">
            <Field label="Description">
              <FitTextarea
                rows={3}
                maxChars={420}
                area={{
                  w: Z_INITIAL.phase1Description.w,
                  h: Z_INITIAL.phase1Description.h,
                }}
                value={data.initial.phase1.description}
                onChange={(v) =>
                  patch((d) => ({
                    ...d,
                    initial: {
                      ...d.initial,
                      phase1: { ...d.initial.phase1, description: v },
                    },
                  }))
                }
                placeholder="e.g., Pairs jog around half-pitch, ball rolling between them. 4 min."
              />
            </Field>
            <Field label="Coaching">
              <FitTextarea
                rows={3}
                maxChars={420}
                area={{
                  w: Z_INITIAL.phase1Coaching.w,
                  h: Z_INITIAL.phase1Coaching.h,
                }}
                value={data.initial.phase1.coaching}
                onChange={(v) =>
                  patch((d) => ({
                    ...d,
                    initial: {
                      ...d.initial,
                      phase1: { ...d.initial.phase1, coaching: v },
                    },
                  }))
                }
                placeholder="e.g., High-quality first touch, head up before passing."
              />
            </Field>
            <div className="rounded-[10px] border border-zinc-100 bg-zinc-50/80 p-3">
              <div className="mb-2.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                <span>Prévention — stabilité corporelle</span>
                <span>25″ / rep</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {prevRows.map(({ k, l }) => (
                  <div
                    key={k}
                    className="grid grid-cols-1 items-start gap-1.5 md:grid-cols-[88px_1fr_1fr]"
                  >
                    <div className="pt-2 text-[11px] font-semibold leading-tight text-zinc-700">
                      {l}
                    </div>
                    <textarea
                      rows={2}
                      className={txtaClass}
                      placeholder="Description"
                      value={pv[k].description}
                      onChange={(e) =>
                        patch((d) => ({
                          ...d,
                          initial: {
                            ...d.initial,
                            phase1: {
                              ...d.initial.phase1,
                              prevention: {
                                ...d.initial.phase1.prevention,
                                [k]: {
                                  ...d.initial.phase1.prevention[k],
                                  description: e.target.value,
                                },
                              },
                            },
                          },
                        }))
                      }
                    />
                    <textarea
                      rows={2}
                      className={txtaClass}
                      placeholder="Coaching cue"
                      value={pv[k].coaching}
                      onChange={(e) =>
                        patch((d) => ({
                          ...d,
                          initial: {
                            ...d.initial,
                            phase1: {
                              ...d.initial.phase1,
                              prevention: {
                                ...d.initial.phase1.prevention,
                                [k]: {
                                  ...d.initial.phase1.prevention[k],
                                  coaching: e.target.value,
                                },
                              },
                            },
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "p2" && (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[2fr_3fr]">
          <Field label="Schéma terrain">
            <SchemaEditor
              settingsKey="warmup"
              value={data.initial.phase2.schema}
              onChange={(v) =>
                patch((d) => ({
                  ...d,
                  initial: {
                    ...d.initial,
                    phase2: { ...d.initial.phase2, schema: v },
                  },
                }))
              }
            />
          </Field>
          <div className="flex flex-col gap-2.5">
            <Field label="Description">
              <FitTextarea
                rows={5}
                maxChars={420}
                area={{
                  w: Z_INITIAL.phase2Description.w,
                  h: Z_INITIAL.phase2Description.h,
                }}
                value={data.initial.phase2.description}
                onChange={(v) =>
                  patch((d) => ({
                    ...d,
                    initial: {
                      ...d.initial,
                      phase2: { ...d.initial.phase2, description: v },
                    },
                  }))
                }
                placeholder="e.g., Rondo 4v2 in 8m square, two-touch. 3×4 min."
              />
            </Field>
            <Field label="Coaching">
              <FitTextarea
                rows={5}
                maxChars={420}
                area={{
                  w: Z_INITIAL.phase2Coaching.w,
                  h: Z_INITIAL.phase2Coaching.h,
                }}
                value={data.initial.phase2.coaching}
                onChange={(v) =>
                  patch((d) => ({
                    ...d,
                    initial: {
                      ...d.initial,
                      phase2: { ...d.initial.phase2, coaching: v },
                    },
                  }))
                }
                placeholder="e.g., Rotate defenders after winning. Cue: scan before receiving."
              />
            </Field>
          </div>
        </div>
      )}

      {tab === "p3" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Field label="Description">
            <textarea
              rows={7}
              className={txtaClass}
              placeholder="e.g., 4×10m sprint with change of direction at cone, 30s rest. 3 sets."
              value={data.initial.phase3.description}
              onChange={(e) =>
                patch((d) => ({
                  ...d,
                  initial: {
                    ...d.initial,
                    phase3: {
                      ...d.initial.phase3,
                      description: e.target.value,
                    },
                  },
                }))
              }
            />
          </Field>
          <Field label="Coaching">
            <textarea
              rows={7}
              className={txtaClass}
              placeholder="e.g., Full intensity. Walk back recovery. Stay low through the change of direction."
              value={data.initial.phase3.coaching}
              onChange={(e) =>
                patch((d) => ({
                  ...d,
                  initial: {
                    ...d.initial,
                    phase3: {
                      ...d.initial.phase3,
                      coaching: e.target.value,
                    },
                  },
                }))
              }
            />
          </Field>
        </div>
      )}
    </div>
  );
}

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

/* Step 3 / 4 — Main block */
function StepMain({
  slot,
  data,
  patch,
  zones,
  library,
}: {
  slot: 0 | 1;
  data: PreparationData;
  patch: Patcher;
  zones: MainZones;
  library: LibraryExercise[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const ex = data.main[slot];
  function upd<K extends keyof PreparationData["main"][number]>(
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

  function importFromLibrary(picked: LibraryExercise) {
    const fill = buildMainBlockFromLibrary(picked, data.focusFamilies);
    patch((d) => ({
      ...d,
      main: d.main.map((m, i) =>
        i === slot
          ? {
              ...m,
              type: "exercise",
              duration: fill.duration || m.duration,
              description: fill.description,
              coaching: fill.coaching,
              organisation: fill.organisation,
              variations: fill.variations,
              exerciseId: fill.exerciseId,
              imageUrl: fill.imageUrl,
            }
          : m,
      ) as PreparationData["main"],
    }));
    setPickerOpen(false);
  }

  function clearImport() {
    patch((d) => ({
      ...d,
      main: d.main.map((m, i) =>
        i === slot ? { ...m, exerciseId: undefined, imageUrl: undefined } : m,
      ) as PreparationData["main"],
    }));
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <DurPill
          value={ex.duration}
          onChange={(v) => upd("duration", v)}
          placeholder="20 min"
        />
        <div className="flex flex-1 gap-2">
          <RadioCard
            label="Forme jouée"
            hint="Game-like"
            active={ex.type === "playForm"}
            onClick={() => upd("type", "playForm")}
          />
          <RadioCard
            label="Exercice"
            hint="Analytic drill"
            active={ex.type === "exercise"}
            onClick={() => upd("type", "exercise")}
          />
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-zinc-900 bg-zinc-900 px-3 py-2 text-[12px] font-medium text-white transition hover:bg-zinc-800"
        >
          <BookOpen className="h-3.5 w-3.5" strokeWidth={2} />
          Importer depuis bibliothèque
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Field label="Schéma terrain">
          {ex.imageUrl ? (
            <div className="relative overflow-hidden rounded-[10px] border-[1.5px] border-zinc-200 bg-zinc-100">
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={ex.imageUrl}
                  alt="Imported exercise diagram"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-contain"
                />
              </div>
              <button
                type="button"
                onClick={clearImport}
                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition hover:bg-white hover:text-zinc-900"
                title="Retirer l'image et revenir au schéma éditable"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
                Retirer l&apos;image
              </button>
            </div>
          ) : (
            <SchemaEditor
              pitch="full-vertical"
              settingsKey="block"
              value={ex.schema}
              onChange={(v) => upd("schema", v)}
            />
          )}
        </Field>
        <div className="flex flex-col gap-2.5">
          <Field label="Description">
            <FitTextarea
              rows={4}
              maxChars={520}
              area={{ w: zones.description.w, h: zones.description.h }}
              value={ex.description}
              onChange={(v) => upd("description", v)}
              placeholder="e.g., Build-up: GK + back four + #6 vs 3 high-pressing strikers."
            />
          </Field>
          <Field label="Coaching">
            <FitTextarea
              rows={3}
              maxChars={520}
              area={{ w: zones.coaching.w, h: zones.coaching.h }}
              value={ex.coaching}
              onChange={(v) => upd("coaching", v)}
              placeholder="e.g., Trigger = back-pass to GK. Reward forward passes through the gate."
            />
          </Field>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Field label="Organisation">
              <FitTextarea
                rows={3}
                maxChars={300}
                area={{ w: zones.organisation.w, h: zones.organisation.h }}
                value={ex.organisation}
                onChange={(v) => upd("organisation", v)}
                placeholder="e.g., Half-pitch. 3 yellow gates on the half-line."
              />
            </Field>
            <Field label="Variations">
              <FitTextarea
                rows={3}
                maxChars={300}
                area={{ w: zones.variations.w, h: zones.variations.h }}
                value={ex.variations}
                onChange={(v) => upd("variations", v)}
                placeholder="+ harder  − easier"
              />
            </Field>
          </div>
        </div>
      </div>
      <ExerciseLibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        exercises={library}
        phases={data.phases}
        focusFamilies={data.focusFamilies}
        onPick={importFromLibrary}
      />
    </div>
  );
}

/* Step 5 — Final game & wrap-up */
function Step5({ data, patch }: { data: PreparationData; patch: Patcher }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-semibold text-zinc-900">
            Jeu final
          </div>
          <DurPill
            value={data.game.duration}
            onChange={(v) =>
              patch((d) => ({ ...d, game: { ...d.game, duration: v } }))
            }
            placeholder="15 min"
          />
        </div>
        <Field label="Schéma terrain">
          <SchemaEditor
            pitch="full-horizontal"
            settingsKey="game"
            value={data.game.schema}
            onChange={(v) =>
              patch((d) => ({ ...d, game: { ...d.game, schema: v } }))
            }
          />
        </Field>
        <Field label="Notes — format, contraintes, coaching">
          <FitTextarea
            rows={4}
            maxChars={360}
            area={{ w: Z_END.gameNotes.w, h: Z_END.gameNotes.h }}
            value={data.game.notes}
            onChange={(v) =>
              patch((d) => ({ ...d, game: { ...d.game, notes: v } }))
            }
            placeholder="e.g., 11v11 full pitch. Normal rules. Last 15 min."
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3.5">
        <Card
          title="Fin de séance"
          rightAction={
            <DurPill
              value={data.end.duration}
              onChange={(v) =>
                patch((d) => ({ ...d, end: { ...d.end, duration: v } }))
              }
              placeholder="5 min"
            />
          }
        >
          <Field label="Notes">
            <FitTextarea
              rows={4}
              maxChars={360}
              area={{ w: Z_END.endNotes.w, h: Z_END.endNotes.h }}
              value={data.end.notes}
              onChange={(v) =>
                patch((d) => ({ ...d, end: { ...d.end, notes: v } }))
              }
              placeholder="e.g., Walk to center circle. 60s breathing. Quick verbal debrief."
            />
          </Field>
        </Card>
        <Card title="Réflexion post-séance">
          <Field label="Notes personnelles après la séance">
            <FitTextarea
              rows={6}
              maxChars={360}
              area={{ w: Z_END.reflection.w, h: Z_END.reflection.h }}
              value={data.reflection}
              onChange={(v) => patch((d) => ({ ...d, reflection: v }))}
              placeholder="What worked, what didn't, who needs individual work next week."
            />
          </Field>
        </Card>
      </div>
    </div>
  );
}

function ReviewCard({
  title,
  status,
  onEdit,
  rows,
}: {
  title: string;
  status: SectionStatus;
  onEdit: () => void;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-zinc-200 bg-white shadow-[0_1px_3px_rgb(0_0_0/0.05)]">
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-zinc-900">
          <StatusDot status={status} />
          {title}
        </div>
        <button
          type="button"
          className="rounded-[6px] px-2.5 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          onClick={onEdit}
        >
          Edit
        </button>
      </div>
      <div className="px-3.5 py-1">
        {rows.map(([k, v], i) => {
          const empty = !v || !v.trim();
          return (
            <div
              key={i}
              className="flex items-baseline justify-between gap-2.5 border-b border-zinc-50 py-1.5 last:border-b-0"
            >
              <span className="shrink-0 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-400">
                {k}
              </span>
              <span
                className={`max-w-[58%] truncate text-right text-[12px] ${empty ? "text-zinc-300" : "text-zinc-900"}`}
              >
                {empty ? "—" : v}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Step 6 — Review & export */
function Step6({
  data,
  statuses,
  onJumpTo,
  onExport,
}: {
  data: PreparationData;
  statuses: SectionStatus[];
  onJumpTo: (i: number) => void;
  onExport: () => void;
}) {
  const phaseLabels: Array<[keyof PreparationData["phases"], string]> = [
    ["possession", "Possession"],
    ["losing", "Losing"],
    ["noPossession", "No possession"],
    ["recovering", "Recovering"],
  ];
  const activePhases = phaseLabels
    .filter(([k]) => data.phases[k])
    .map(([, l]) => l)
    .join(", ");

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-gradient-to-br from-[#0c0c0d] to-zinc-800 p-5 shadow-[0_4px_24px_rgb(0_0_0/0.18)]">
        <div>
          <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/40">
            Ready to print
          </div>
          <div className="text-[15px] font-semibold text-white">
            {data.team || "Your team"} — Preparation sheet
          </div>
          <div className="mt-0.5 text-[12px] text-white/50">
            {data.date || "No date"} · Coach {data.coach || "—"}
          </div>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-zinc-200 bg-white px-4 text-[13px] font-medium text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition hover:bg-zinc-50 active:scale-[0.98]"
        >
          <Printer className="h-3.5 w-3.5" strokeWidth={2} />
          Export PDF
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <ReviewCard
          title="1 · Session brief"
          status={statuses[0]}
          onEdit={() => onJumpTo(0)}
          rows={[
            ["Date", data.date],
            ["Team", data.team],
            ["Coach", data.coach],
            ["Game moments", activePhases],
            ["Forme", data.characteristicForm],
            ["Objectifs", data.objectives],
          ]}
        />
        <ReviewCard
          title="2 · Warm-up & prep"
          status={statuses[1]}
          onEdit={() => onJumpTo(1)}
          rows={[
            ["Duration", data.initial.duration],
            ["Phase 1", data.initial.phase1.description],
            ["Phase 2", data.initial.phase2.description],
            ["Phase 3", data.initial.phase3.description],
          ]}
        />
        <ReviewCard
          title="3 · Main block 1"
          status={statuses[2]}
          onEdit={() => onJumpTo(2)}
          rows={[
            [
              "Type",
              data.main[0].type === "playForm" ? "Forme jouée" : "Exercice",
            ],
            ["Duration", data.main[0].duration],
            ["Description", data.main[0].description],
            ["Organisation", data.main[0].organisation],
          ]}
        />
        <ReviewCard
          title="4 · Main block 2"
          status={statuses[3]}
          onEdit={() => onJumpTo(3)}
          rows={[
            [
              "Type",
              data.main[1].type === "playForm" ? "Forme jouée" : "Exercice",
            ],
            ["Duration", data.main[1].duration],
            ["Description", data.main[1].description],
            ["Organisation", data.main[1].organisation],
          ]}
        />
        <ReviewCard
          title="5 · Final game & wrap-up"
          status={statuses[4]}
          onEdit={() => onJumpTo(4)}
          rows={[
            ["Game duration", data.game.duration],
            ["Game notes", data.game.notes],
            ["End duration", data.end.duration],
            ["Reflection", data.reflection],
          ]}
        />
      </div>
    </div>
  );
}

/* ============================================================
 * APP SHELL
 * ============================================================ */

const STEPS = [
  {
    label: "Session brief",
    eyebrow: "Step 1 of 5",
    desc: "Set the date, team and game moment(s) this session is built around.",
  },
  {
    label: "Warm-up & prep",
    eyebrow: "Step 2 of 5",
    desc: "Mobility, technical / tactical warmup, then a short explosive block.",
  },
  {
    label: "Main block 1",
    eyebrow: "Step 3 of 5",
    desc: "Your first central training block — forme jouée or exercise.",
  },
  {
    label: "Main block 2",
    eyebrow: "Step 4 of 5",
    desc: "Second central training block.",
  },
  {
    label: "Final game & wrap-up",
    eyebrow: "Step 5 of 5",
    desc: "Match-style game, cool-down and post-session reflection.",
  },
  {
    label: "Review & export",
    eyebrow: "Final review",
    desc: "Check each section, then export the official ASF preparation sheet.",
  },
] as const;

export function PreparationSheet({
  teamId,
  sessionId,
  initial,
  libraryExercises,
}: {
  teamId: string;
  sessionId: string;
  initial: PreparationData;
  libraryExercises: LibraryExercise[];
}) {
  const [data, setData] = useState<PreparationData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [stepKey, setStepKey] = useState(0);
  const locale = useLocale();
  const router = useRouter();

  const patch = useCallback<Patcher>((updater) => {
    setDirty(true);
    setData(updater);
  }, []);

  const statuses = useMemo(() => computeStatuses(data), [data]);
  const completeCount = statuses.filter((s) => s === "complete").length;
  const pct = Math.round((completeCount / 5) * 100);

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
        setDirty(false);
        setJustSaved(true);
      }
    });
  }

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(t);
  }, [justSaved]);

  function loadExample() {
    if (
      dirty &&
      !confirm("This will replace the current sheet with an example. Continue?")
    ) {
      return;
    }
    patch(() => exampleSheet());
  }

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  function goTo(i: number) {
    setStep(i);
    setStepKey((k) => k + 1);
  }

  const stepBody: ReactNode = (() => {
    switch (step) {
      case 0:
        return <Step1 data={data} patch={patch} />;
      case 1:
        return <Step2 data={data} patch={patch} />;
      case 2:
        return (
          <StepMain
            slot={0}
            data={data}
            patch={patch}
            zones={Z_MAIN_1}
            library={libraryExercises}
          />
        );
      case 3:
        return (
          <StepMain
            slot={1}
            data={data}
            patch={patch}
            zones={Z_MAIN_2}
            library={libraryExercises}
          />
        );
      case 4:
        return <Step5 data={data} patch={patch} />;
      default:
        return (
          <Step6
            data={data}
            statuses={statuses}
            onJumpTo={goTo}
            onExport={handlePrint}
          />
        );
    }
  })();

  return (
    <>
      <div className="prep-no-print fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0c0c0d] text-zinc-900">
        {/* Topbar */}
        <header className="relative z-10 flex h-[52px] flex-shrink-0 items-center justify-between border-b border-white/10 bg-[#0c0c0d]/90 px-5 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1 border-0 bg-transparent text-[12px] text-white/40 transition hover:text-white/80"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Back
            </button>
            <span className="mx-3 h-[18px] w-px bg-white/10" />
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-white text-[14px] font-bold text-[#0c0c0d] shadow-[0_0_0_1px_rgb(255_255_255/0.15)]">
              G
            </div>
            <div className="min-w-0 leading-none">
              <div className="text-[13px] font-semibold text-white">
                Training preparation
              </div>
              <div className="mt-0.5 truncate text-[10px] text-white/35">
                {data.team || "No team set"} · {data.date || "No date"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="mr-1 flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-[5px]">
              <div className="h-[3px] w-20 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-white/50">
                {pct}%
              </span>
            </div>
            <button
              type="button"
              onClick={loadExample}
              className="hidden h-8 items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-medium text-white/60 transition hover:bg-white/5 hover:text-white sm:inline-flex"
              title="Load example data"
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={2} />
              Example
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="inline-flex h-8 min-w-[88px] items-center justify-center gap-1.5 rounded-[8px] border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <Loader2
                    className="h-3 w-3 animate-spin"
                    strokeWidth={2.5}
                  />
                  Saving…
                </>
              ) : justSaved ? (
                <>
                  <Check
                    className="h-3 w-3 text-emerald-500"
                    strokeWidth={2.5}
                  />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-3 w-3" strokeWidth={2} />
                  Save
                </>
              )}
            </button>
          </div>
        </header>

        {/* Shell */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="hidden w-[232px] shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[#111113] md:flex">
            <div className="px-4 pb-2 pt-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/25">
              Preparation steps
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
              {STEPS.map((s, i) => {
                const st: SectionStatus | null = i < 5 ? statuses[i] : null;
                const isActive = step === i;
                const numCls = isActive
                  ? "bg-white text-[#111]"
                  : st === "complete"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : st === "partial"
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-white/[0.06] text-white/30";
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    className={`relative flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition ${
                      isActive
                        ? "bg-white/[0.09]"
                        : "hover:bg-white/[0.05]"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-white" />
                    )}
                    <span
                      className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-[11px] font-semibold transition ${numCls}`}
                    >
                      {st === "complete" && !isActive ? (
                        <Check className="h-[11px] w-[11px]" strokeWidth={3} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[12px] font-medium leading-tight transition ${
                          isActive
                            ? "text-white"
                            : "text-white/50 group-hover:text-white/80"
                        }`}
                      >
                        {s.label}
                      </span>
                    </span>
                    {st && !isActive && <StatusDot status={st} dark />}
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-white/[0.06] px-4 py-3.5">
              <div className="mb-1.5 flex justify-between">
                <span className="text-[10px] text-white/30">Progress</span>
                <span className="text-[10px] font-semibold text-white/60">
                  {pct}%
                </span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-white to-white/70 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </aside>

          {/* Content panel */}
          <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f8f8f9]">
            {/* Mobile step pills */}
            <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-zinc-200 bg-white px-4 py-2.5 md:hidden">
              {STEPS.map((s, i) => {
                const isActive = step === i;
                const st: SectionStatus | null = i < 5 ? statuses[i] : null;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                      isActive
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : st === "complete"
                            ? "bg-emerald-500 text-white"
                            : st === "partial"
                              ? "bg-amber-200 text-amber-800"
                              : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {!isActive && st === "complete" ? (
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* Step header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 bg-white px-7 py-4">
              <div className="min-w-0">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  {STEPS[step].eyebrow}
                </div>
                <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[#0c0c0d]">
                  {STEPS[step].label}
                </h2>
                <p className="mt-1 text-[13px] text-zinc-500">
                  {STEPS[step].desc}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => goTo(Math.max(0, step - 1))}
                  disabled={step === 0}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => goTo(Math.min(STEPS.length - 1, step + 1))}
                  disabled={step === STEPS.length - 1}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[#0c0c0d] px-3 text-[12px] font-medium text-white shadow-[0_1px_3px_rgb(0_0_0/0.15)] transition hover:bg-[#1a1a1d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            </div>

            {error && (
              <div className="shrink-0 border-b border-red-200 bg-red-50 px-7 py-2.5 text-[12px] text-red-700">
                {error}
              </div>
            )}

            {/* Step body */}
            <div
              key={stepKey}
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-7 py-5 motion-safe:animate-[prep-step-in_250ms_cubic-bezier(0.4,0,0.2,1)]"
            >
              {stepBody}
            </div>
          </section>
        </div>
      </div>

      {/* PDF output (hidden on screen, shown only on print) */}
      <PdfExport data={data} />
    </>
  );
}
