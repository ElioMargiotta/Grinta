"use client";

import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Printer,
  Save,
  Timer,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { cancelSessionAction } from "@/app/[locale]/(app)/planner/actions";
import { savePreparationAction } from "@/app/[locale]/(app)/planner/[teamId]/sessions/[sessionId]/preparation/actions";
import { useLoading } from "@/components/ui/LoadingProvider";
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
  developmentQuestions: { x: 63, y: 72, w: 134, h: 10 },
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
  phase2Coaching: { x: 137, y: 200, w: 60, h: 37 },
  phase3Schema: { x: 18, y: 246, w: 51, h: 34 },
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
  gameSchema: { x: 14.5, y: 198, w: 60, h: 31 },
  gameNotes: { x: 76, y: 196.5, w: 60, h: 35 },
  endDuration: { x: 151.5, y: 232, w: 39, h: 6 },
  endNotes: { x: 76, y: 238, w: 60, h: 18 },
  reflection: { x: 14, y: 268, w: 183, h: 18 },
} as const;

function PdfExport({ data }: { data: PreparationData }) {
  return (
    <div className="prep-export hidden print:block">
      <ExportPage bg="/documents/svg/page1.svg">
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
        {data.initial.phase3.imageUrl && (
          <ExportImage
            src={data.initial.phase3.imageUrl}
            area={Z_INITIAL.phase3Schema}
          />
        )}
        <ExportText
          value={data.initial.phase3.description}
          area={Z_INITIAL.phase3Description}
        />
        <ExportText
          value={data.initial.phase3.coaching}
          area={Z_INITIAL.phase3Coaching}
        />
      </ExportPage>

      <ExportPage bg="/documents/svg/page2.svg">
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
        {data.game.imageUrl ? (
          <ExportImage src={data.game.imageUrl} area={Z_END.gameSchema} />
        ) : (
          <ExportSchema
            data={data.game.schema}
            area={Z_END.gameSchema}
            settingsKey="game"
          />
        )}
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

const txtaClass =
  "w-full resize-none rounded-[9px] border-[1.5px] border-zinc-200 bg-white px-3 py-2.5 text-[13px] leading-[1.55] text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.04)] outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:shadow-[0_0_0_3px_rgb(12_12_13/0.07)]";

const GRINTA_GREEN = "#16a34a";

const inpUlClass =
  "w-full border-0 border-b border-zinc-200 bg-transparent px-0 pb-1.5 pt-0 text-[15px] font-medium text-zinc-900 outline-none transition placeholder:text-zinc-300 focus:border-[var(--g-green)]";
const txtaUlClass =
  "w-full resize-none border-0 border-b border-zinc-200 bg-transparent px-0 pb-1.5 pt-0 text-[14px] leading-[1.5] text-zinc-900 outline-none transition placeholder:text-zinc-300 focus:border-[var(--g-green)]";

function FieldUl({
  label,
  hint,
  charMax,
  charVal,
  children,
}: {
  label?: string;
  hint?: string;
  charMax?: number;
  charVal?: number;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">
          {label}
        </div>
      ) : null}
      {children}
      {hint || charMax !== undefined ? (
        <div className="flex items-center justify-between">
          {hint ? (
            <span className="text-[11px] text-zinc-400">{hint}</span>
          ) : (
            <span />
          )}
          {charMax !== undefined ? (
            <span className="text-[10px] tabular-nums text-zinc-400">
              {charVal ?? 0}/{charMax}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type PrepT = ReturnType<typeof useTranslations<"sheet.preparation">>;

function focusFamilyLabel(t: PrepT, f: FocusFamily): string {
  return t(`focusFamily.${f}`);
}

const FOCUS_FAMILY_COLORS: Record<FocusFamily, string> = {
  TA: "#2563eb",
  TE: "#16a34a",
  PE: "#dc2626",
  AT: "#7c3aed",
};

function formatFocusFamilies(t: PrepT, families: FocusFamily[]): string {
  return families
    .map((f) => `${f} - ${focusFamilyLabel(t, f)}`)
    .join(" ; ");
}

function FocusFamilyChips({
  value,
  onChange,
}: {
  value: FocusFamily[];
  onChange: (next: FocusFamily[]) => void;
}) {
  const t = useTranslations("sheet.preparation");
  function toggle(f: FocusFamily) {
    if (value.includes(f)) onChange(value.filter((x) => x !== f));
    else onChange([...value, f]);
  }
  return (
    <div className="flex items-center gap-3 overflow-hidden">
      {FOCUS_FAMILIES.map((f) => {
        const active = value.includes(f);
        return (
          <button
            key={f}
            type="button"
            onClick={() => toggle(f)}
            className={`group flex min-w-0 items-center gap-1.5 border-b pb-1 text-left transition ${
              active
                ? "border-zinc-900 text-zinc-950"
                : "border-zinc-200 text-zinc-400 hover:border-zinc-400 hover:text-zinc-700"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
                active ? "opacity-100" : "opacity-35 group-hover:opacity-70"
              }`}
              style={{ background: FOCUS_FAMILY_COLORS[f] }}
            />
            <span className="font-mono text-[11px] font-semibold tabular-nums">
              {f}
            </span>
            <span className="truncate text-[10px] font-medium">
              {focusFamilyLabel(t, f)}
            </span>
          </button>
        );
      })}
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
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  area: { w: number; h: number };
  rows?: number;
  placeholder?: string;
  maxChars?: number;
  className?: string;
}) {
  const t = useTranslations("sheet.preparation");
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

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = e.clipboardData.getData("text");
    if (!pasted) return;

    const target = e.currentTarget;
    const start = target.selectionStart ?? value.length;
    const end = target.selectionEnd ?? start;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const maxPasteLength =
      maxChars === undefined
        ? pasted.length
        : Math.max(0, maxChars - before.length - after.length);
    const pasteText = pasted.slice(0, maxPasteLength);

    e.preventDefault();

    const candidate = `${before}${pasteText}${after}`;
    if (fitsInExportBox(candidate, area.w, area.h)) {
      onChange(candidate);
      return;
    }

    let lo = 0;
    let hi = pasteText.length;
    let best = "";
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const next = `${before}${pasteText.slice(0, mid)}${after}`;
      if (fitsInExportBox(next, area.w, area.h)) {
        best = pasteText.slice(0, mid);
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    const clipped = `${before}${best}${after}`;
    if (clipped !== value && fitsInExportBox(clipped, area.w, area.h)) {
      onChange(clipped);
    }
  }

  const baseClass = className ?? txtaClass;
  const overflowFlag = className
    ? "border-red-400 focus:border-red-500"
    : "border-red-300 focus:border-red-500 focus:shadow-[0_0_0_3px_rgb(239_68_68/0.12)]";
  const showFooter = !fits || maxChars !== undefined;

  return (
    <div className="flex flex-col gap-1">
      <textarea
        rows={rows}
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder={placeholder}
        className={`${baseClass} ${fits ? "" : overflowFlag}`}
      />
      {showFooter ? (
        <div className="flex items-center justify-between text-[10px]">
          <span className={fits ? "text-transparent" : "text-red-600"}>
            {fits ? t("fits") : t("tooLong")}
          </span>
          {maxChars !== undefined && (
            <span
              className={`tabular-nums ${
                value.length >= maxChars ? "text-red-600" : "text-zinc-400"
              }`}
            >
              {value.length}/{maxChars}
            </span>
          )}
        </div>
      ) : null}
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

export type SessionMeta = {
  title: string;
  startTime: string;
  durationMinutes: number | null;
};

const SESSION_TITLE_MAX = 20;

type SessionMetaPatcher = (updater: (m: SessionMeta) => SessionMeta) => void;

type PhaseKey = "possession" | "losing" | "noPossession" | "recovering";

const WEEK_THEME_ALLOWED: Record<string, PhaseKey[]> = {
  possede_ballon: ["possession"],
  ne_possede_pas: ["noPossession"],
  recupere: ["recovering"],
  perd: ["losing"],
  recupere_perd: ["recovering", "losing"],
  decharge: [],
  jeux_polysport: [],
};

const WEEK_THEME_KEYS = new Set([
  "possede_ballon",
  "ne_possede_pas",
  "recupere",
  "perd",
  "recupere_perd",
  "decharge",
  "jeux_polysport",
]);

function weekThemeLabel(t: PrepT, key: string): string {
  return t(`weekThemeLabel.${key}` as Parameters<PrepT>[0]);
}

const SLOT_BOUNDS: Record<
  "morning" | "afternoon",
  { min: string; max: string }
> = {
  morning: { min: "07:00", max: "11:59" },
  afternoon: { min: "12:00", max: "22:00" },
};

function slotFromStart(time: string): "morning" | "afternoon" {
  const hh = Number(time.slice(0, 2));
  return Number.isFinite(hh) && hh >= 12 ? "afternoon" : "morning";
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function clampToSlot(time: string, slot: "morning" | "afternoon"): string {
  if (!time) return time;
  const { min, max } = SLOT_BOUNDS[slot];
  const v = timeToMin(time);
  if (v < timeToMin(min)) return min;
  if (v > timeToMin(max)) return max;
  return time;
}


/* Step 1 — Session brief */
function Step1({
  data,
  patch,
  meta,
  patchMeta,
  slot,
  onCancel,
  isCancelling,
  weekTheme,
}: {
  data: PreparationData;
  patch: Patcher;
  meta: SessionMeta;
  patchMeta: SessionMetaPatcher;
  slot: "morning" | "afternoon";
  onCancel: () => void;
  isCancelling: boolean;
  weekTheme: string | null;
}) {
  const t = useTranslations("sheet.preparation");
  const bounds = SLOT_BOUNDS[slot];

  const allowedPhases =
    weekTheme && weekTheme in WEEK_THEME_ALLOWED
      ? WEEK_THEME_ALLOWED[weekTheme]
      : null;
  const weekLabel =
    weekTheme && WEEK_THEME_KEYS.has(weekTheme)
      ? weekThemeLabel(t, weekTheme)
      : null;
  const selectedPhases = (Object.keys(data.phases) as PhaseKey[]).filter(
    (k) => data.phases[k],
  );
  const offThemeSelected =
    allowedPhases !== null &&
    selectedPhases.some((k) => !allowedPhases.includes(k));
  const phaseOptions = (["possession", "losing", "noPossession", "recovering"] as const).map(
    (key) => ({
      key,
      label: t(`step1.phaseOptionLabel.${key}`),
      fr: t(`step1.phaseOptionTheme.${key}`),
    }),
  );
  const selectedPhase =
    phaseOptions.find((ph) => data.phases[ph.key]) ?? null;

  function selectPhase(key: PhaseKey) {
    patch((d) => ({
      ...d,
      phases: {
        possession: key === "possession",
        losing: key === "losing",
        noPossession: key === "noPossession",
        recovering: key === "recovering",
      },
    }));
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 py-1">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600">
              {t("guidedBrief")}
            </div>
            <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[#0c0c0d]">
              {t("buildThread")}
            </h2>
            <p className="mt-0.5 max-w-[640px] text-[12px] leading-4 text-zinc-500">
              {t("keepFieldLogic")}
            </p>
          </div>
        </div>

        <div className="self-center border-l border-zinc-200 pl-5 text-[12px] text-zinc-500">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              {t("step1.sectionLabel")}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="flex min-w-0 items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-zinc-400" />
              <input
                className={inpUlClass}
                maxLength={SESSION_TITLE_MAX}
                placeholder={t("step1.sessionTitlePlaceholder")}
                value={meta.title.slice(0, SESSION_TITLE_MAX)}
                onChange={(e) =>
                  patchMeta((m) => ({
                    ...m,
                    title: e.target.value.slice(0, SESSION_TITLE_MAX),
                  }))
                }
              />
              <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
                {meta.title.slice(0, SESSION_TITLE_MAX).length}/
                {SESSION_TITLE_MAX}
              </span>
            </label>
            <label className="flex min-w-0 items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />
              <input
                type="date"
                className={inpUlClass}
                value={data.date}
                onChange={(e) =>
                  patch((d) => ({ ...d, date: e.target.value }))
                }
              />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex min-w-0 items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="time"
                  className={inpUlClass}
                  min={bounds.min}
                  max={bounds.max}
                  value={meta.startTime}
                  onChange={(e) =>
                    patchMeta((m) => ({
                      ...m,
                      startTime: clampToSlot(e.target.value, slot),
                    }))
                  }
                />
              </label>
              <label className="flex min-w-0 items-center gap-2">
                <Timer className="h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="number"
                  min={1}
                  className={inpUlClass}
                  placeholder={t("step1.durationPlaceholder")}
                  value={meta.durationMinutes ?? ""}
                  onChange={(e) =>
                    patchMeta((m) => ({
                      ...m,
                      durationMinutes: e.target.value
                        ? Number(e.target.value)
                        : null,
                    }))
                  }
                />
              </label>
            </div>
            <label className="flex min-w-0 items-center gap-2">
              <Users className="h-3.5 w-3.5 text-zinc-400" />
              <input
                className={inpUlClass}
                placeholder={t("step1.teamPlaceholder")}
                value={data.team}
                onChange={(e) =>
                  patch((d) => ({ ...d, team: e.target.value }))
                }
              />
            </label>
            <label className="flex min-w-0 items-center gap-2">
              <User className="h-3.5 w-3.5 text-zinc-400" />
              <input
                className={inpUlClass}
                placeholder={t("step1.coachPlaceholder")}
                value={data.coach}
                onChange={(e) =>
                  patch((d) => ({ ...d, coach: e.target.value }))
                }
              />
            </label>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)]">
        <div className="text-[12px] text-zinc-500">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            {t("step1.momentLabel")}
          </div>
          <div className="space-y-0.5">
            {phaseOptions.map((ph) => {
              const checked = data.phases[ph.key];
              const isRecommended =
                allowedPhases !== null && allowedPhases.includes(ph.key);
              const isOffTheme =
                checked && allowedPhases !== null && !isRecommended;
              return (
                <button
                  key={ph.key}
                  type="button"
                  onClick={() => selectPhase(ph.key)}
                  className={`flex w-full items-center justify-between border-b py-1 text-left transition ${
                    checked
                      ? "border-red-500 text-zinc-950"
                      : isRecommended
                        ? "border-emerald-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
                        : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
                  }`}
                >
                  <span>
                    <span className="block text-[13px] font-semibold">
                      {ph.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-zinc-400">
                      {ph.fr}
                    </span>
                  </span>
                  {checked ? (
                    <Check
                      className={isOffTheme ? "text-amber-500" : "text-red-600"}
                      size={16}
                      strokeWidth={2.4}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          {offThemeSelected ? (
            <p className="mt-3 text-[11px] leading-4 text-amber-700">
              {t("step1.offTheme")}{weekLabel ? ` : ${weekLabel}` : ""}.
            </p>
          ) : null}
        </div>

        <div className="relative pl-6">
          <div className="absolute bottom-2 left-0 top-1 w-px bg-zinc-200" />
          <div className="space-y-2.5">
            <div className="relative">
              <span className="absolute -left-[34px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#0c0c0d] text-[9px] font-semibold text-white">
                1
              </span>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                {t("step1.startingPoint")}
              </div>
              <div className="mt-0.5 text-[16px] font-semibold tracking-[-0.015em] text-zinc-950">
                {t("step1.startingPointPrefix")}{" "}
                <span className="text-red-600">
                  {selectedPhase?.label.toLowerCase() ?? t("step1.startingPointFallback")}
                </span>
                .
              </div>
            </div>

            <div className="relative">
              <span className="absolute -left-[34px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-zinc-500 ring-1 ring-zinc-200">
                2
              </span>
              <FieldUl label={t("step1.field.characteristicForm")}>
                <FitTextarea
                  area={Z_GLOBAL.characteristicForm}
                  rows={2}
                  maxChars={230}
                  placeholder={t("step1.fieldPlaceholder.characteristicForm")}
                  value={data.characteristicForm}
                  onChange={(v) =>
                    patch((d) => ({ ...d, characteristicForm: v }))
                  }
                  className={txtaUlClass}
                />
              </FieldUl>
            </div>

            <div className="relative">
              <span className="absolute -left-[34px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-zinc-500 ring-1 ring-zinc-200">
                3
              </span>
              <FieldUl label={t("step1.field.focus")}>
                <div className="mb-1.5">
	                  <FocusFamilyChips
	                    value={data.focusFamilies}
	                    onChange={(v) => {
	                      const autoFocus = formatFocusFamilies(t, v);
	                      patch((d) => ({
	                        ...d,
	                        focusFamilies: v,
	                        focus: autoFocus.slice(0, 115),
	                      }));
	                    }}
	                  />
	                </div>
                <FitTextarea
                  area={Z_GLOBAL.focus}
                  rows={1}
                  maxChars={115}
                  placeholder={t("step1.fieldPlaceholder.focus")}
                  value={data.focus}
                  onChange={(v) => patch((d) => ({ ...d, focus: v }))}
                  className={txtaUlClass}
                />
              </FieldUl>
            </div>

            <div className="relative">
              <span className="absolute -left-[34px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-zinc-500 ring-1 ring-zinc-200">
                4
              </span>
              <FieldUl label={t("step1.field.objective")}>
                <FitTextarea
                  area={Z_GLOBAL.objectives}
                  rows={2}
                  maxChars={230}
                  placeholder={t("step1.fieldPlaceholder.objective")}
                  value={data.objectives}
                  onChange={(v) => patch((d) => ({ ...d, objectives: v }))}
                  className={txtaUlClass}
                />
              </FieldUl>
            </div>

            <div className="relative">
              <span className="absolute -left-[34px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-zinc-500 ring-1 ring-zinc-200">
                5
              </span>
              <FieldUl label={t("step1.field.coachQuestions")}>
                <FitTextarea
                  area={Z_GLOBAL.developmentQuestions}
                  rows={2}
                  maxChars={260}
                  placeholder={t("step1.fieldPlaceholder.coachQuestions")}
                  value={data.developmentQuestions}
                  onChange={(v) =>
                    patch((d) => ({ ...d, developmentQuestions: v }))
                  }
                  className={txtaUlClass}
                />
              </FieldUl>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-zinc-500 transition hover:text-red-600 disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          {isCancelling ? t("cancellingSession") : t("cancelSession")}
        </button>
      </div>
    </div>
  );
}

function fitImportedText(text: string, area: Box, maxChars: number) {
  const clean = text.trim();
  if (clean.length <= maxChars && fitsInExportBox(clean, area.w, area.h)) {
    return clean;
  }

  let next = clean.slice(0, Math.max(0, maxChars - 3)).trimEnd();
  while (next.length > 0 && !fitsInExportBox(`${next}...`, area.w, area.h)) {
    next = next.slice(0, -12).trimEnd();
  }
  return next ? `${next}...` : "";
}

function buildPhase3Import(ex: LibraryExercise) {
  const coaching = (ex.forme_physique ?? []).map((tag) => `• ${tag}`).join("\n");
  return {
    description: fitImportedText(
      ex.description ?? "",
      Z_INITIAL.phase3Description,
      420,
    ),
    coaching: fitImportedText(coaching, Z_INITIAL.phase3Coaching, 420),
    exerciseId: ex.id,
    imageUrl: ex.main_image ?? "",
  };
}

function buildFinalGameImport(ex: LibraryExercise, focusFamilies: FocusFamily[]) {
  const fill = buildMainBlockFromLibrary(ex, focusFamilies);
  const notes = [
    fill.description,
    fill.organisation && `Organisation:\n${fill.organisation}`,
    fill.coaching && `Coaching:\n${fill.coaching}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    notes: fitImportedText(notes, Z_END.gameNotes, 360),
    duration: fill.duration,
    exerciseId: fill.exerciseId,
    imageUrl: fill.imageUrl,
  };
}

/* Step 2 — Warm-up & prep (tabbed phases) */
function Step2({
  data,
  patch,
  library,
}: {
  data: PreparationData;
  patch: Patcher;
  library: LibraryExercise[];
}) {
  const t = useTranslations("sheet.preparation");
  const [tab, setTab] = useState<"p1" | "p2" | "p3">("p1");
  const [phase3PickerOpen, setPhase3PickerOpen] = useState(false);
  const pv = data.initial.phase1.prevention;
  const phase3Exercises = useMemo(
    () =>
      library.filter(
        (ex) =>
          ex.theme === "Explosivité" ||
          ex.source === "asf_co_2026" ||
          ex.code?.startsWith("CO_EX_"),
      ),
    [library],
  );
  const prevRows = [
    {
      k: "ankle" as const,
      l: t("step2.bodyPart.ankle"),
      descriptionArea: Z_INITIAL.ankleDescription,
      coachingArea: Z_INITIAL.ankleCoaching,
    },
    {
      k: "knee" as const,
      l: t("step2.bodyPart.knee"),
      descriptionArea: Z_INITIAL.kneeDescription,
      coachingArea: Z_INITIAL.kneeCoaching,
    },
    {
      k: "hip" as const,
      l: t("step2.bodyPart.hip"),
      descriptionArea: Z_INITIAL.hipDescription,
      coachingArea: Z_INITIAL.hipCoaching,
    },
    {
      k: "hamstring" as const,
      l: t("step2.bodyPart.hamstring"),
      descriptionArea: Z_INITIAL.hamstringDescription,
      coachingArea: Z_INITIAL.hamstringCoaching,
    },
  ];
  const tabs: Array<["p1" | "p2" | "p3", string, string]> = [
    ["p1", t("step2.tabName.p1"), t("step2.tabHint.p1")],
    ["p2", t("step2.tabName.p2"), t("step2.tabHint.p2")],
    ["p3", t("step2.tabName.p3"), t("step2.tabHint.p3")],
  ];
  const activePhaseTitle = t(`step2.phaseTitle.${tab}`);

  function importPhase3(picked: LibraryExercise) {
    const fill = buildPhase3Import(picked);
    patch((d) => ({
      ...d,
      initial: {
        ...d.initial,
        phase3: {
          ...d.initial.phase3,
          description: fill.description,
          coaching: fill.coaching,
          exerciseId: fill.exerciseId,
          imageUrl: fill.imageUrl,
        },
      },
    }));
    setPhase3PickerOpen(false);
  }

  function clearPhase3Import() {
    patch((d) => ({
      ...d,
      initial: {
        ...d.initial,
        phase3: {
          ...d.initial.phase3,
          exerciseId: undefined,
          imageUrl: undefined,
        },
      },
    }));
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 py-1">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_500px]">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600">
            {t("step2.eyebrow")}
          </div>
          <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[#0c0c0d]">
            {t("step2.title")}
          </h2>
          <p className="mt-0.5 max-w-[620px] text-[12px] leading-4 text-zinc-500">
            {t("step2.subtitle")}
          </p>
        </div>
        <div className="self-center border-l border-zinc-200 pl-5">
          <div className="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_120px]">
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  {t("step2.threeParts")}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {tabs.map(([id], idx) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`h-7 border-b text-center text-[11px] font-semibold transition ${
                      tab === id
                        ? "border-red-500 text-zinc-950"
                        : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    {t("phaseLabel", { n: idx + 1 })}
                  </button>
                ))}
              </div>
            </div>
            <FieldUl label={t("step2.totalDuration")}>
              <div className="flex items-center gap-2">
                <Timer className="h-3.5 w-3.5 text-zinc-400" />
                <input
                  value={data.initial.duration}
                  onChange={(e) =>
                    patch((d) => ({
                      ...d,
                      initial: { ...d.initial, duration: e.target.value },
                    }))
                  }
                  placeholder={t("step2.totalDurationPlaceholder")}
                  className={inpUlClass}
                />
              </div>
            </FieldUl>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 pt-2">
        <div className="border-t border-zinc-200 pt-3">
          <div className="text-[13px] font-semibold text-zinc-900">
            {activePhaseTitle}
          </div>
        </div>
        <div className="min-w-0">
          {tab === "p1" && (
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(300px,0.68fr)_minmax(0,1.32fr)]">
              <div>
                <div className="overflow-hidden [&>div]:border-0 [&>div]:bg-transparent">
                  <SchemaEditor
                    settingsKey="warmup"
                    showHint={false}
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
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldUl label={t("stepMain.field.content")}>
                    <FitTextarea
                      rows={6}
                      maxChars={420}
                      area={Z_INITIAL.phase1Description}
                      value={data.initial.phase1.description}
                      onChange={(v) =>
                        patch((d) => ({
                          ...d,
                          initial: {
                            ...d.initial,
                            phase1: {
                              ...d.initial.phase1,
                              description: v,
                            },
                          },
                        }))
                      }
                      placeholder={t("step2.p1ContentPlaceholder")}
                      className={txtaUlClass}
                    />
                  </FieldUl>
                  <FieldUl label={t("stepMain.field.coaching")}>
                    <FitTextarea
                      rows={6}
                      maxChars={420}
                      area={Z_INITIAL.phase1Coaching}
                      value={data.initial.phase1.coaching}
                      onChange={(v) =>
                        patch((d) => ({
                          ...d,
                          initial: {
                            ...d.initial,
                            phase1: {
                              ...d.initial.phase1,
                              coaching: v,
                            },
                          },
                        }))
                      }
                      placeholder={t("step2.p1CoachingPlaceholder")}
                      className={txtaUlClass}
                    />
                  </FieldUl>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                    <span>{t("preventionLabel")}</span>
                    <span>{t("preventionDuration")}</span>
                  </div>
                  <div className="grid gap-x-4 gap-y-2 md:grid-cols-2">
                    {prevRows.map(
                      ({ k, l, descriptionArea, coachingArea }) => (
                        <div key={k} className="grid gap-1">
                          <div className="text-[11px] font-semibold text-zinc-700">
                            {l}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <FitTextarea
                              rows={2}
                              maxChars={90}
                              area={descriptionArea}
                              placeholder={t("placeholder.exercise")}
                              value={pv[k].description}
                              onChange={(v) =>
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
                                          description: v,
                                        },
                                      },
                                    },
                                  },
                                }))
                              }
                              className={txtaUlClass}
                            />
                            <FitTextarea
                              rows={2}
                              maxChars={120}
                              area={coachingArea}
                              placeholder={t("placeholder.instruction")}
                              value={pv[k].coaching}
                              onChange={(v) =>
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
                                          coaching: v,
                                        },
                                      },
                                    },
                                  },
                                }))
                              }
                              className={txtaUlClass}
                            />
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "p2" && (
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(300px,0.68fr)_minmax(0,1.32fr)]">
              <div>
                <div className="overflow-hidden [&>div]:border-0 [&>div]:bg-transparent">
                  <SchemaEditor
                    settingsKey="warmup"
                    showHint={false}
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
                </div>
              </div>
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <FieldUl label={t("stepMain.field.content")}>
                  <FitTextarea
                    rows={9}
                    maxChars={420}
                    area={Z_INITIAL.phase2Description}
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
                    placeholder={t("step2.p2ContentPlaceholder")}
                    className={txtaUlClass}
                  />
                </FieldUl>
                <FieldUl label={t("stepMain.field.coaching")}>
                  <FitTextarea
                    rows={9}
                    maxChars={560}
                    area={Z_INITIAL.phase2Coaching}
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
                    placeholder={t("step2.p2CoachingPlaceholder")}
                    className={txtaUlClass}
                  />
                </FieldUl>
              </div>
            </div>
          )}

          {tab === "p3" && (
            <div className="grid grid-cols-1 gap-5">
              <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-2">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-zinc-900">
                    {t("phase3Header")}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                    {data.initial.phase3.exerciseId
                      ? t("importedHint")
                      : t("phase3ImportHint")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {data.initial.phase3.imageUrl && (
                    <button
                      type="button"
                      onClick={clearPhase3Import}
                      className="inline-flex h-7 items-center gap-1.5 border-b border-zinc-300 px-1 text-[11px] font-semibold text-zinc-500 transition hover:border-zinc-900 hover:text-zinc-900"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                      {t("removeBtn")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPhase3PickerOpen(true)}
                    className="inline-flex h-7 items-center gap-1.5 border-b border-zinc-900 px-1 text-[11px] font-semibold text-zinc-950 transition hover:border-red-500 hover:text-red-600"
                  >
                    <BookOpen className="h-3.5 w-3.5" strokeWidth={2} />
                    {t("importBtn")}
                  </button>
                </div>
              </div>
              {data.initial.phase3.imageUrl && (
                <div className="relative max-w-[360px] overflow-hidden">
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={data.initial.phase3.imageUrl}
                      alt={t("alt.explosivityImported")}
                      fill
                      sizes="360px"
                      className="object-contain"
                    />
                  </div>
                </div>
              )}
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <FieldUl label={t("stepMain.field.content")}>
                  <FitTextarea
                    rows={10}
                    maxChars={420}
                    area={Z_INITIAL.phase3Description}
                    value={data.initial.phase3.description}
                    onChange={(v) =>
                      patch((d) => ({
                        ...d,
                        initial: {
                          ...d.initial,
                          phase3: {
                            ...d.initial.phase3,
                            description: v,
                          },
                        },
                      }))
                    }
                    placeholder={t("step2.p3ContentPlaceholder")}
                    className={txtaUlClass}
                  />
                </FieldUl>
                <FieldUl label={t("stepMain.field.coaching")}>
                  <FitTextarea
                    rows={10}
                    maxChars={420}
                    area={Z_INITIAL.phase3Coaching}
                    value={data.initial.phase3.coaching}
                    onChange={(v) =>
                      patch((d) => ({
                        ...d,
                        initial: {
                          ...d.initial,
                          phase3: {
                            ...d.initial.phase3,
                            coaching: v,
                          },
                        },
                      }))
                    }
                    placeholder={t("step2.p3CoachingPlaceholder")}
                    className={txtaUlClass}
                  />
                </FieldUl>
              </div>
              <ExerciseLibraryPicker
                open={phase3PickerOpen}
                onClose={() => setPhase3PickerOpen(false)}
                exercises={phase3Exercises}
                phases={data.phases}
                focusFamilies={["PE"]}
                onPick={importPhase3}
                title={t("phase3LibraryTitle")}
                subtitle={t("explosivityImportHint", { count: phase3Exercises.length })}
                phaseFiltering={false}
              />
            </div>
          )}
        </div>
      </section>
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
  const t = useTranslations("sheet.preparation");
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
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 py-0">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600">
            {t("stepMain.eyebrow", { n: slot + 1 })}
          </div>
          <h2 className="mt-0.5 text-[20px] font-semibold tracking-[-0.02em] text-[#0c0c0d]">
            {t("stepMain.title")}
          </h2>
          <p className="mt-0.5 max-w-[620px] text-[12px] leading-4 text-zinc-500">
            {t("stepMain.subtitle")}
          </p>
        </div>
        <div className="self-center border-l border-zinc-200 pl-5">
          <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1fr)_95px]">
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                {t("stepMain.format")}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  ["playForm", t("stepMain.type.playForm")],
                  ["exercise", t("stepMain.type.exercise")],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      upd("type", id as PreparationData["main"][number]["type"])
                    }
                    className={`h-6 border-b text-center text-[11px] font-semibold transition ${
                      ex.type === id
                        ? "border-red-500 text-zinc-950"
                        : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <FieldUl label={t("stepMain.duration")}>
              <div className="flex items-center gap-2">
                <Timer className="h-3.5 w-3.5 text-zinc-400" />
                <input
                  value={ex.duration}
                  onChange={(e) => upd("duration", e.target.value)}
                  placeholder={t("stepMain.durationPlaceholder")}
                  className={inpUlClass}
                />
              </div>
            </FieldUl>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200 pt-1">
        <div className="mb-1.5 flex items-center justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold text-zinc-900">
              {ex.type === "playForm" ? t("stepMain.type.playForm") : t("stepMain.type.exercise")}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 border-b border-zinc-900 px-1 text-[11px] font-semibold text-zinc-950 transition hover:border-red-500 hover:text-red-600"
          >
            <BookOpen className="h-3.5 w-3.5" strokeWidth={2} />
            {t("importBtn")}
          </button>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(280px,0.62fr)_minmax(0,1.38fr)]">
          <div className="overflow-hidden [&>div]:border-0 [&>div]:bg-transparent">
            {ex.imageUrl ? (
              <div className="relative overflow-hidden">
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={ex.imageUrl}
                    alt={t("alt.exerciseImported")}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={clearImport}
                  className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition hover:bg-white hover:text-zinc-900"
                  title={t("stepMain.removeImage")}
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                  {t("stepMain.removeImageButton")}
                </button>
              </div>
            ) : (
              <SchemaEditor
                pitch="full-vertical"
                settingsKey="block"
                showHint={false}
                value={ex.schema}
                onChange={(v) => upd("schema", v)}
              />
            )}
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2">
          <FieldUl label={t("stepMain.field.content")}>
            <FitTextarea
              rows={7}
              maxChars={520}
              area={{ w: zones.description.w, h: zones.description.h }}
              value={ex.description}
              onChange={(v) => upd("description", v)}
              placeholder={t("stepMain.placeholder.content")}
              className={txtaUlClass}
            />
          </FieldUl>
          <FieldUl label={t("stepMain.field.coaching")}>
            <FitTextarea
              rows={7}
              maxChars={520}
              area={{ w: zones.coaching.w, h: zones.coaching.h }}
              value={ex.coaching}
              onChange={(v) => upd("coaching", v)}
              placeholder={t("stepMain.placeholder.coaching")}
              className={txtaUlClass}
            />
          </FieldUl>
          <FieldUl label={t("stepMain.field.organization")}>
              <FitTextarea
                rows={3}
                maxChars={300}
                area={{ w: zones.organisation.w, h: zones.organisation.h }}
                value={ex.organisation}
                onChange={(v) => upd("organisation", v)}
                placeholder={t("stepMain.placeholder.organization")}
                className={txtaUlClass}
              />
          </FieldUl>
          <FieldUl label={t("stepMain.field.variations")}>
              <FitTextarea
                rows={3}
                maxChars={300}
                area={{ w: zones.variations.w, h: zones.variations.h }}
                value={ex.variations}
                onChange={(v) => upd("variations", v)}
                placeholder={t("stepMain.placeholder.variations")}
                className={txtaUlClass}
              />
          </FieldUl>
          </div>
        </div>
      </section>
      <ExerciseLibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        exercises={library}
        phases={data.phases}
        focusFamilies={data.focusFamilies}
        onPick={importFromLibrary}
        subtitle={t("stepMain.librarySubtitle")}
        phaseFiltering={false}
      />
    </div>
  );
}

/* Step 5 — Final game & wrap-up */
function Step5({
  data,
  patch,
  library,
}: {
  data: PreparationData;
  patch: Patcher;
  library: LibraryExercise[];
}) {
  const t = useTranslations("sheet.preparation");
  const [pickerOpen, setPickerOpen] = useState(false);

  function importFinalGame(picked: LibraryExercise) {
    const fill = buildFinalGameImport(picked, data.focusFamilies);
    patch((d) => ({
      ...d,
      game: {
        ...d.game,
        duration: fill.duration || d.game.duration,
        notes: fill.notes,
        exerciseId: fill.exerciseId,
        imageUrl: fill.imageUrl,
      },
    }));
    setPickerOpen(false);
  }

  function clearFinalGameImport() {
    patch((d) => ({
      ...d,
      game: {
        ...d.game,
        exerciseId: undefined,
        imageUrl: undefined,
      },
    }));
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 py-0">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600">
            {t("step5.eyebrow")}
          </div>
          <h2 className="mt-0.5 text-[20px] font-semibold tracking-[-0.02em] text-[#0c0c0d]">
            {t("step5.title")}
          </h2>
          <p className="mt-0.5 max-w-[620px] text-[12px] leading-4 text-zinc-500">
            {t("step5.subtitle")}
          </p>
        </div>
        <div className="self-center border-l border-zinc-200 pl-5">
          <div className="grid items-end gap-3 lg:grid-cols-2">
            <FieldUl label={t("step5.field.finalGame")}>
              <div className="flex items-center gap-2">
                <Timer className="h-3.5 w-3.5 text-zinc-400" />
                <input
                  value={data.game.duration}
                  onChange={(e) =>
                    patch((d) => ({
                      ...d,
                      game: { ...d.game, duration: e.target.value },
                    }))
                  }
                  placeholder={t("step5.placeholder.finalGameDuration")}
                  className={inpUlClass}
                />
              </div>
            </FieldUl>
            <FieldUl label={t("step5.field.coolDown")}>
              <div className="flex items-center gap-2">
                <Timer className="h-3.5 w-3.5 text-zinc-400" />
                <input
                  value={data.end.duration}
                  onChange={(e) =>
                    patch((d) => ({
                      ...d,
                      end: { ...d.end, duration: e.target.value },
                    }))
                  }
                  placeholder={t("step5.placeholder.coolDownDuration")}
                  className={inpUlClass}
                />
              </div>
            </FieldUl>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200 pt-1.5">
        <div className="mb-1.5 flex items-center justify-between gap-4">
          <div className="text-[13px] font-semibold text-zinc-900">
            {t("step5.finalGameHeader")}
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 border-b border-zinc-900 px-1 text-[11px] font-semibold text-zinc-950 transition hover:border-red-500 hover:text-red-600"
          >
            <BookOpen className="h-3.5 w-3.5" strokeWidth={2} />
            {t("importBtn")}
          </button>
        </div>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(330px,0.78fr)_minmax(0,1.22fr)]">
          <div className="overflow-hidden [&>div]:border-0 [&>div]:bg-transparent">
            {data.game.imageUrl ? (
              <div className="relative overflow-hidden">
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={data.game.imageUrl}
                    alt={t("alt.finalGameImported")}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={clearFinalGameImport}
                  className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition hover:bg-white hover:text-zinc-900"
                  title={t("stepMain.removeImage")}
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                  {t("stepMain.removeImageButton")}
                </button>
              </div>
            ) : (
              <SchemaEditor
                pitch="full-horizontal"
                settingsKey="game"
                showHint={false}
                value={data.game.schema}
                onChange={(v) =>
                  patch((d) => ({ ...d, game: { ...d.game, schema: v } }))
                }
              />
            )}
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            <FieldUl label={t("step5.field.format")}>
              <FitTextarea
                rows={7}
                maxChars={360}
                area={{ w: Z_END.gameNotes.w, h: Z_END.gameNotes.h }}
                value={data.game.notes}
                onChange={(v) =>
                  patch((d) => ({ ...d, game: { ...d.game, notes: v } }))
                }
                placeholder={t("step5.placeholder.format")}
                className={txtaUlClass}
              />
            </FieldUl>
            <FieldUl label={t("step5.field.coolDown")}>
              <FitTextarea
                rows={7}
                maxChars={360}
                area={{ w: Z_END.endNotes.w, h: Z_END.endNotes.h }}
                value={data.end.notes}
                onChange={(v) =>
                  patch((d) => ({ ...d, end: { ...d.end, notes: v } }))
                }
                placeholder={t("step5.placeholder.coolDown")}
                className={txtaUlClass}
              />
            </FieldUl>
            <div className="md:col-span-2">
              <FieldUl label={t("step5.field.reflection")}>
                <FitTextarea
                  rows={3}
                  maxChars={360}
                  area={{ w: Z_END.reflection.w, h: Z_END.reflection.h }}
                  value={data.reflection}
                  onChange={(v) => patch((d) => ({ ...d, reflection: v }))}
                  placeholder={t("step5.placeholder.reflection")}
                  className={txtaUlClass}
                />
              </FieldUl>
            </div>
          </div>
        </div>
      </section>
      <ExerciseLibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        exercises={library}
        phases={data.phases}
        focusFamilies={data.focusFamilies}
        onPick={importFinalGame}
        title={t("step5.libraryTitle")}
        subtitle={t("step5.librarySubtitle")}
        phaseFiltering={false}
      />
    </div>
  );
}

function ReviewValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const t = useTranslations("sheet.preparation");
  const empty = !value.trim();
  return (
    <div className="border-b border-zinc-200 pb-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-0.5 truncate text-[13px] font-medium ${
          empty ? "text-zinc-300" : "text-zinc-950"
        }`}
      >
        {empty ? t("status.toFill") : value}
      </div>
    </div>
  );
}

function ReviewCheck({
  label,
  status,
  onEdit,
}: {
  label: string;
  status: SectionStatus;
  onEdit: () => void;
}) {
  const t = useTranslations("sheet.preparation");
  const text =
    status === "complete"
      ? t("status.complete")
      : status === "partial"
        ? t("status.partial")
        : t("status.empty");
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex items-center justify-between gap-3 border-b border-zinc-200 py-1.5 text-left transition hover:border-zinc-400"
    >
      <span className="flex min-w-0 items-center gap-2">
        <StatusDot status={status} />
        <span className="truncate text-[13px] font-medium text-zinc-900">
          {label}
        </span>
      </span>
      <span className="shrink-0 text-[11px] font-medium text-zinc-400">
        {text}
      </span>
    </button>
  );
}

/* Step 6 — Review & export */
function Step6({
  data,
  meta,
  statuses,
  onJumpTo,
  onExport,
}: {
  data: PreparationData;
  meta: SessionMeta;
  statuses: SectionStatus[];
  onJumpTo: (i: number) => void;
  onExport: () => void;
}) {
  const t = useTranslations("sheet.preparation");
  const phaseLabels: Array<[keyof PreparationData["phases"], string]> = [
    ["possession", t("step1.phaseOptionLabel.possession")],
    ["losing", t("step1.phaseOptionLabel.losing")],
    ["noPossession", t("step1.phaseOptionLabel.noPossession")],
    ["recovering", t("step1.phaseOptionLabel.recovering")],
  ];
  const activePhases = phaseLabels
    .filter(([k]) => data.phases[k])
    .map(([, l]) => l)
    .join(", ");
  const totalDuration =
    meta.durationMinutes !== null ? `${meta.durationMinutes} min` : "";
  const blockDurations = [
    data.initial.duration && `${t("step6.blockShort.warmup")} ${data.initial.duration}`,
    data.main[0].duration && `${t("step6.blockShort.b1")} ${data.main[0].duration}`,
    data.main[1].duration && `${t("step6.blockShort.b2")} ${data.main[1].duration}`,
    data.game.duration && `${t("step6.blockShort.game")} ${data.game.duration}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto grid w-full max-w-[1120px] gap-5 py-1 lg:grid-cols-[minmax(0,1fr)_330px]">
      <section className="min-w-0">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600">
            {t("step6.eyebrow")}
          </div>
          <h2 className="mt-0.5 text-[20px] font-semibold tracking-[-0.02em] text-[#0c0c0d]">
            {t("step6.title")}
          </h2>
          <p className="mt-0.5 max-w-[620px] text-[12px] leading-4 text-zinc-500">
            {t("step6.subtitle")}
          </p>
        </div>

        <div className="mt-5 grid gap-x-6 gap-y-3 md:grid-cols-2">
          <ReviewValue label={t("review.planningTitle")} value={meta.title} />
          <ReviewValue label={t("review.date")} value={data.date} />
          <ReviewValue label={t("review.startTime")} value={meta.startTime} />
          <ReviewValue label={t("review.duration")} value={totalDuration} />
          <ReviewValue label={t("review.team")} value={data.team} />
          <ReviewValue label={t("review.coach")} value={data.coach} />
          <ReviewValue label={t("review.gameMoment")} value={activePhases} />
          <ReviewValue label={t("review.focus")} value={data.focus} />
          <ReviewValue label={t("review.objective")} value={data.objectives} />
          <ReviewValue label={t("review.blockDurations")} value={blockDurations} />
        </div>

        <div className="mt-6 border-t border-zinc-200 pt-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
            {t("step6.quickCheck")}
          </div>
          <div className="grid gap-x-6 md:grid-cols-2">
            <ReviewCheck
              label={t("step6.section.brief")}
              status={statuses[0]}
              onEdit={() => onJumpTo(0)}
            />
            <ReviewCheck
              label={t("step6.section.warmup")}
              status={statuses[1]}
              onEdit={() => onJumpTo(1)}
            />
            <ReviewCheck
              label={t("step6.section.main1")}
              status={statuses[2]}
              onEdit={() => onJumpTo(2)}
            />
            <ReviewCheck
              label={t("step6.section.main2")}
              status={statuses[3]}
              onEdit={() => onJumpTo(3)}
            />
            <ReviewCheck
              label={t("step6.section.finalGame")}
              status={statuses[4]}
              onEdit={() => onJumpTo(4)}
            />
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-[10px] border border-zinc-200 bg-white p-2 shadow-[0_8px_28px_rgb(0_0_0/0.08)]">
          <div className="relative aspect-[210/297] overflow-hidden bg-white">
            <Image
              src="/documents/svg/page1.svg"
              alt={t("alt.pdfPreview")}
              fill
              sizes="330px"
              className="object-contain"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] bg-[#0c0c0d] px-4 text-[13px] font-semibold text-white shadow-[0_1px_3px_rgb(0_0_0/0.15)] transition hover:bg-[#1a1a1d] active:scale-[0.98]"
        >
          <Printer className="h-4 w-4" strokeWidth={2} />
          {t("exportPdf")}
        </button>
      </aside>
    </div>
  );
}

/* ============================================================
 * APP SHELL
 * ============================================================ */

type PreparationStep = { label: string; eyebrow: string; desc: string };
const STEP_COUNT = 6;

export function PreparationSheet({
  teamId,
  sessionId,
  initial,
  libraryExercises,
  sessionMeta,
  weekTheme,
}: {
  teamId: string | null;
  sessionId: string;
  initial: PreparationData;
  libraryExercises: LibraryExercise[];
  sessionMeta: SessionMeta;
  weekTheme: string | null;
}) {
  const [data, setData] = useState<PreparationData>(initial);
  const [meta, setMeta] = useState<SessionMeta>(sessionMeta);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [stepKey, setStepKey] = useState(0);
  const stepBodyRef = useRef<HTMLDivElement | null>(null);
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("sheet.preparation");
  const tCommon = useTranslations("common");
  const { run } = useLoading();
  const messages = useMessages() as {
    sheet: { preparation: { steps: PreparationStep[] } };
  };
  const STEPS = messages.sheet.preparation.steps;

  const slot = useMemo<"morning" | "afternoon">(
    () => slotFromStart(sessionMeta.startTime || meta.startTime || "10:00"),
    // Lock slot to the session's original time so the user can't switch halves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const patch = useCallback<Patcher>((updater) => {
    setDirty(true);
    setData(updater);
  }, []);

  const patchMeta = useCallback<SessionMetaPatcher>((updater) => {
    setDirty(true);
    setMeta(updater);
  }, []);

  const statuses = useMemo(() => computeStatuses(data), [data]);
  const completeCount = statuses.filter((s) => s === "complete").length;
  const pct = Math.round((completeCount / 5) * 100);

  function cancelSession() {
    if (!confirm(t("cancelConfirm"))) return;
    setError(null);
    startTransition(async () => {
      const result = await run(
        () =>
          cancelSessionAction({
            teamId,
            sessionId,
            locale,
          }),
        { label: t("cancellingSession"), message: tCommon("pleaseWait") },
      );
      if (result?.error) setError(result.error);
    });
  }

  function save() {
    setError(null);
    const durationMinutes = meta.durationMinutes ?? 90;
    startTransition(async () => {
      const result = await run(
        () =>
          savePreparationAction({
            teamId,
            sessionId,
            locale,
            data,
            sessionMeta: {
              title: meta.title.trim().slice(0, SESSION_TITLE_MAX),
              startTime: meta.startTime || null,
              durationMinutes,
            },
          }),
        { label: t("saving"), message: tCommon("pleaseWait") },
      );
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

  useEffect(() => {
    stepBodyRef.current?.scrollTo({ top: 0 });
  }, [stepKey]);

  function loadExample() {
    if (dirty && !confirm(t("loadExampleConfirm"))) {
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

  function goPrev() {
    goTo(Math.max(0, step - 1));
  }

  function goNext() {
    goTo(Math.min(STEPS.length - 1, step + 1));
  }

  const stepBody: ReactNode = (() => {
    switch (step) {
      case 0:
        return (
          <Step1
            data={data}
            patch={patch}
            meta={meta}
            patchMeta={patchMeta}
            slot={slot}
            onCancel={cancelSession}
            isCancelling={isPending}
            weekTheme={weekTheme}
          />
        );
      case 1:
        return <Step2 data={data} patch={patch} library={libraryExercises} />;
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
        return <Step5 data={data} patch={patch} library={libraryExercises} />;
      default:
        return (
          <Step6
            data={data}
            meta={meta}
            statuses={statuses}
            onJumpTo={goTo}
            onExport={handlePrint}
          />
        );
    }
  })();

  return (
    <>
      <div
        className="prep-no-print fixed inset-0 z-50 flex flex-col overflow-hidden bg-white text-zinc-900 dark:bg-black dark:text-zinc-100"
        style={{ ["--g-green" as string]: GRINTA_GREEN }}
      >
        {/* Topbar */}
        <header className="relative z-10 flex h-[52px] flex-shrink-0 items-center justify-between border-b border-zinc-200 bg-white/95 px-5 backdrop-blur-md dark:border-zinc-800 dark:bg-black/95">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1 border-0 bg-transparent text-[12px] font-medium text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
              {t("back")}
            </button>
            <span className="mx-3 h-[18px] w-px bg-zinc-200 dark:bg-zinc-800" />
            <Image
              src="/documents/svg/grinta-icon.svg"
              alt=""
              width={28}
              height={28}
              priority
              className="h-7 w-7 shrink-0"
            />
            <div className="min-w-0 leading-none">
              <div className="text-[13px] font-semibold text-zinc-950 dark:text-white">
                {t("header")}
              </div>
              <div className="mt-0.5 truncate text-[10px] text-zinc-500">
                {data.team || t("noTeam")} · {data.date || t("noDate")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="mr-1 flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-[5px] dark:bg-zinc-900">
              <div className="h-[3px] w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-full rounded-full bg-zinc-950 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] dark:bg-zinc-100"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-zinc-500">
                {pct}%
              </span>
            </div>
            <button
              type="button"
              onClick={loadExample}
              className="hidden h-8 items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 sm:inline-flex"
              title={t("loadExampleTitle")}
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={2} />
              {t("example")}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="inline-flex h-8 min-w-[88px] items-center justify-center gap-1.5 rounded-[8px] border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {isPending ? (
                <>
                  <Loader2
                    className="h-3 w-3 animate-spin"
                    strokeWidth={2.5}
                  />
                  {t("saving")}
                </>
              ) : justSaved ? (
                <>
                  <Check
                    className="h-3 w-3 text-emerald-500"
                    strokeWidth={2.5}
                  />
                  {t("saved")}
                </>
              ) : (
                <>
                  <Save className="h-3 w-3" strokeWidth={2} />
                  {t("save")}
                </>
              )}
            </button>
          </div>
        </header>

        {/* Shell */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="hidden w-[232px] shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-white md:flex dark:border-zinc-800 dark:bg-black">
            <div className="flex items-center gap-2 px-4 pb-3 pt-4">
              <Image
                src="/documents/svg/grinta-icon.svg"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5"
              />
              <Image
                src="/documents/svg/grinta-wordmark.svg"
                alt="Grinta"
                width={72}
                height={20}
                className="h-5 w-auto"
              />
            </div>
            <div className="px-4 pb-2 pt-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
              {t("stepsLabel")}
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
              {STEPS.map((s, i) => {
                const st: SectionStatus | null = i < 5 ? statuses[i] : null;
                const isActive = step === i;
                const numCls = isActive
                  ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-black"
                  : st === "complete"
                    ? "bg-emerald-50 text-emerald-600"
                    : st === "partial"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-400";
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={isActive ? "step" : undefined}
                    className={`group relative flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition ${
                      isActive
                        ? "bg-zinc-50 dark:bg-zinc-900"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-red-500" />
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
                            ? "text-zinc-950 dark:text-white"
                            : "text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-white"
                        }`}
                      >
                        {s.label}
                      </span>
                    </span>
                    {st && !isActive && <StatusDot status={st} />}
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-zinc-200 px-4 py-3.5 dark:border-zinc-800">
              <div className="mb-1.5 flex justify-between">
                <span className="text-[10px] text-zinc-400">{t("progress")}</span>
                <span className="text-[10px] font-semibold text-zinc-600">
                  {pct}%
                </span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-full rounded-full bg-zinc-950 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] dark:bg-zinc-100"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </aside>

          {/* Content panel */}
          <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f8f8f9] dark:bg-zinc-950">
            {/* Mobile step pills */}
            <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-zinc-200 bg-white px-4 py-2.5 md:hidden dark:border-zinc-800 dark:bg-black">
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
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black"
                        : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
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
            <div className="flex shrink-0 items-center justify-between gap-4 px-7 pb-0 pt-2">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  {STEPS[step].eyebrow}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={step === 0}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                  {t("back")}
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={step === STEPS.length - 1}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[#0c0c0d] px-3 text-[12px] font-medium text-white shadow-[0_1px_3px_rgb(0_0_0/0.15)] transition hover:bg-[#1a1a1d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {t("next")}
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
              ref={stepBodyRef}
              key={stepKey}
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-7 py-2 motion-safe:animate-[prep-step-in_180ms_cubic-bezier(0.4,0,0.2,1)]"
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
