"use client";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Hash,
  Loader2,
  MapPin,
  Printer,
  Save,
  Trash2,
  User,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMessages, useTranslations } from "next-intl";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  deletePlayerEvaluationAction,
  savePlayerEvaluationAction,
  setEvaluationSharedAction,
} from "@/app/[locale]/(app)/contingent/[playerId]/evaluations/actions";
import { useLoading } from "@/components/ui/LoadingProvider";
import {
  APPRECIATION_OPTIONS,
  type AppreciationLevel,
  type EvaluationData,
  TIPS_CRITERIA,
  type TipsCriterionId,
  type TipsGroup,
  TIPS_GROUPS,
  groupAverage,
  overallAverage,
} from "./types";

/* ============================================================
 * PDF EXPORT VIEW   ⚠️  DO NOT MODIFY  ⚠️
 *   Two A4 pages with `Evaluation Xamax.pdf` rendered as PNG
 *   backgrounds (`/documents/evaluation/page-{1,2}.png`). Form
 *   text absolutely-positioned in mm. Coordinates are calibrated
 *   to the template — keep them in sync if the template ever
 *   changes. Visual UX edits happen only in the WEB FORM section.
 * ============================================================ */

const PAGE_W = 210;
const PAGE_H = 297;
const GRINTA_GREEN = "#16a34a";

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
  "block h-full w-full overflow-hidden whitespace-pre-wrap break-words px-1 py-0.5 leading-tight text-black";

// Default font is 11px / regular. Pass `size` (in px) and `bold` to override
// for fields that need to stand out (e.g. season header, average score).
function ExportText({
  value,
  area,
  size = 11,
  bold = false,
}: {
  value: string;
  area: Box;
  size?: number;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        ...box(area),
        fontSize: `${size}px`,
        fontWeight: bold ? 700 : 400,
      }}
      className={exportFieldClass}
    >
      {value}
    </div>
  );
}

function ExportCheck({ checked, area }: { checked: boolean; area: Box }) {
  return (
    <div
      style={box(area)}
      className="flex items-center justify-center text-[14px] font-bold leading-none text-black"
    >
      {checked ? "✗" : ""}
    </div>
  );
}

// Renders a TIPS score number in the fixed score cell on the printed sheet.
function ExportScore({ score, y }: { score: number; y: number }) {
  if (score <= 0) return null;
  const label = Number.isInteger(score)
    ? String(score)
    : score.toFixed(1).replace(".", ",");
  return (
    <div
      style={box({ ...TIPS_SCORE_CELL, y })}
      className="flex items-center justify-center text-[11px] font-bold leading-none text-black"
    >
      {label}
    </div>
  );
}

function ExportPage({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <div
      className="prep-page relative bg-white"
      style={{ width: `${PAGE_W}mm`, height: `${PAGE_H}mm` }}
    >
      {/* Plain img avoids print-time layout differences from Next/Image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bg}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
      />
      {children}
    </div>
  );
}

const Z1_HEADER = {
  teamLogo: { x: 172, y: 4, w: 22, h: 22 },
  season: { x: 99, y: 19, w: 35, h: 6 },
  team: { x: 33, y: 29.5, w: 60, h: 5 },
  playerName: { x: 133, y: 29.5, w: 60, h: 5 },
  birthDate: { x: 52, y: 35, w: 32, h: 5 },
  position: { x: 98, y: 35, w: 30, h: 5 },
  evaluationDate: { x: 170, y: 35, w: 60, h: 5 },
} as const;

const Z1_STATS = {
  tour1Matches: { x: 44, y: 54, w: 65, h: 5 },
  tour1PlayTime: { x: 44, y: 59, w: 65, h: 5 },
  tour1Height: { x: 44, y: 64, w: 65, h: 5 },
  tour1Weight: { x: 44, y: 69, w: 65, h: 5 },
  tour2Matches: { x: 135, y: 54, w: 65, h: 5 },
  tour2PlayTime: { x: 135, y: 59, w: 65, h: 5 },
  tour2Height: { x: 135, y: 64, w: 65, h: 5 },
  tour2Weight: { x: 135, y: 69, w: 65, h: 5 },
} as const;

const Z1_ASF = {
  tour1Speed10: { x: 44, y: 79, w: 65, h: 5 },
  tour1Speed30: { x: 44, y: 84, w: 65, h: 5 },
  tour1ProAgility: { x: 44, y: 89, w: 57, h: 5 },
  tour1Yoyo: { x: 44, y: 94, w: 65, h: 5 },
  tour1Agility: { x: 44, y: 99, w: 65, h: 5 },
  tour1BallControl: { x: 44, y: 104, w: 57, h: 5 },
  tour1Juggling: { x: 44, y: 109, w: 65, h: 5 },
  tour2Speed10: { x: 135, y: 79, w: 65, h: 5 },
  tour2Speed30: { x: 135, y: 84, w: 65, h: 5 },
  tour2ProAgility: { x: 135, y: 89, w: 57, h: 5 },
  tour2Yoyo: { x: 135, y: 94, w: 65, h: 5 },
  tour2Agility: { x: 135, y: 99, w: 65, h: 5 },
  tour2BallControl: { x: 135, y: 104, w: 57, h: 5 },
  tour2Juggling: { x: 135, y: 109, w: 65, h: 5 },
} as const;

// y positions of each criterion row inside the TIPS table on page 1.
// The table header is ~y=120–134; each row is ~5mm tall. Principes
// Offensifs / Défensifs are merged cells spanning 2 / 4 sub-lines, so
// the score checkmark is vertically centered inside the merged cell.
const TIPS_ROW_Y: Record<TipsCriterionId, number> = {
  T_firstTouch: 154.5,
  T_ballDriving: 160.5,
  T_pass: 166.5,
  T_dribble: 172.1,
  T_shot: 178.5,
  I_scanning: 192.5,
  I_offensive: 202.5, // merged cell over 2 sub-lines (y≈182–188)
  I_defensive: 219.5, // merged cell over 4 sub-lines (y≈193–209)
  P_selfAwareness: 238.5,
  P_emotionRegulation: 244.5,
  P_solidarity: 250.5,
  S_speedCoordination: 262.5,
  S_endurance: 268.5,
};

const TIPS_SCORE_CELL = { x: 67, w: 31, h: 5 } as const;

// One free-text comment per TIPS group (T/I/P/S), placed in the
// Commentaires column and spanning the group's vertical extent.
const Z1_TIPS_GROUP_COMMENT: Record<TipsGroup, Box> = {
  T: { x: 116, y: 154.5, w: 78, h: 27 },
  I: { x: 116, y: 190.5, w: 78, h: 40 },
  P: { x: 116, y: 239.5, w: 78, h: 14 },
  S: { x: 116, y: 262.5, w: 78, h: 11 },
};

// Group average (T/I/P/S) — shown as a small bold number in the section
// header band, far right.
const Z1_TIPS_GROUP_AVG: Record<TipsGroup, Box> = {
  T: { x: 101.5, y: 166.5, w: 12, h: 5 },
  I: { x: 101.5, y: 207.5, w: 12, h: 5 },
  P: { x: 101.5, y: 245.5, w: 12, h: 5 },
  S: { x: 101.5, y: 265.5, w: 12, h: 5 },
};

const Z1_AVERAGE = { x: 101.5, y: 275, w: 31, h: 5 } as const;

const Z2_HEADER = {
  team: { x: 35, y: 22, w: 60, h: 5 },
  playerName: { x: 135, y: 22, w: 60, h: 5 },
  birthDate: { x: 52, y: 28, w: 32, h: 5 },
  position: { x: 97, y: 28, w: 30, h: 5 },
  evaluationDate: { x: 170, y: 28, w: 60, h: 5 },
} as const;

const Z2_STRENGTHS = {
  line1: { x: 26, y: 49, w: 172, h: 7 },
  line2: { x: 26, y: 59, w: 172, h: 7 },
  line3: { x: 26, y: 69, w: 172, h: 7 },
} as const;

const Z2_IMPROVEMENTS = {
  line1: { x: 26, y: 90, w: 172, h: 7 },
  line2: { x: 26, y: 100, w: 172, h: 7 },
  line3: { x: 26, y: 110, w: 172, h: 7 },
} as const;

const Z2_APPRECIATION = {
  good: { x: 24, y: 133.5, w: 6, h: 6 },
  envisageable: { x: 24, y: 144.5, w: 6, h: 6 },
  problematic: { x: 24, y: 155.5, w: 6, h: 6 },
  veryDifficult: { x: 24, y: 166.5, w: 6, h: 6 },
} as const;

const Z2_SIGNATURES = {
  technicalLead: { x: 60, y: 197, w: 70, h: 6 },
  coaches: { x: 35, y: 209, w: 95, h: 25 },
  parents: { x: 140, y: 202, w: 58, h: 32 },
  date: { x: 145, y: 234, w: 50, h: 6 },
} as const;

function PdfExport({
  data,
  teamLogos = [],
}: {
  data: EvaluationData;
  teamLogos?: string[];
}) {
  const avg = overallAverage(data.tips);
  const logo = Z1_HEADER.teamLogo;
  return (
    <div className="prep-export hidden print:block">
      <ExportPage bg="/documents/evaluation/page-1.png">
        {teamLogos.length > 0 ? (
          // Logos du regroupement, ancrés au bord droit de l'emplacement d'origine
          // et empilés vers la gauche (max 3 pour ne pas déborder de l'en-tête).
          <div
            style={{
              position: "absolute",
              top: `${logo.y}mm`,
              height: `${logo.h}mm`,
              right: `${PAGE_W - (logo.x + logo.w)}mm`,
              display: "flex",
              gap: "1mm",
              alignItems: "center",
            }}
          >
            {teamLogos.slice(0, 3).map((url, i) => (
              <div
                key={`${url}-${i}`}
                style={{ position: "relative", height: `${logo.h}mm`, width: `${logo.w}mm` }}
              >
                <Image
                  src={url}
                  alt=""
                  aria-hidden
                  fill
                  unoptimized
                  sizes="22mm"
                  className="object-contain"
                />
              </div>
            ))}
          </div>
        ) : null}

        <ExportText
          value={data.season}
          area={Z1_HEADER.season}
          size={16}
          bold
        />
        <ExportText value={data.team} area={Z1_HEADER.team} />
        <ExportText value={data.playerName} area={Z1_HEADER.playerName} />
        <ExportText value={data.birthDate} area={Z1_HEADER.birthDate} />
        <ExportText value={data.position} area={Z1_HEADER.position} />
        <ExportText
          value={data.evaluationDate}
          area={Z1_HEADER.evaluationDate}
        />

        <ExportText
          value={data.stats.tour1.matches}
          area={Z1_STATS.tour1Matches}
        />
        <ExportText
          value={data.stats.tour1.playTime}
          area={Z1_STATS.tour1PlayTime}
        />
        <ExportText
          value={data.stats.tour1.height}
          area={Z1_STATS.tour1Height}
        />
        <ExportText
          value={data.stats.tour1.weight}
          area={Z1_STATS.tour1Weight}
        />
        <ExportText
          value={data.stats.tour2.matches}
          area={Z1_STATS.tour2Matches}
        />
        <ExportText
          value={data.stats.tour2.playTime}
          area={Z1_STATS.tour2PlayTime}
        />
        <ExportText
          value={data.stats.tour2.height}
          area={Z1_STATS.tour2Height}
        />
        <ExportText
          value={data.stats.tour2.weight}
          area={Z1_STATS.tour2Weight}
        />

        <ExportText value={data.asf.tour1.speed10} area={Z1_ASF.tour1Speed10} />
        <ExportText value={data.asf.tour1.speed30} area={Z1_ASF.tour1Speed30} />
        <ExportText
          value={data.asf.tour1.proAgility}
          area={Z1_ASF.tour1ProAgility}
        />
        <ExportText value={data.asf.tour1.yoyo} area={Z1_ASF.tour1Yoyo} />
        <ExportText value={data.asf.tour1.agility} area={Z1_ASF.tour1Agility} />
        <ExportText
          value={data.asf.tour1.ballControl}
          area={Z1_ASF.tour1BallControl}
        />
        <ExportText
          value={data.asf.tour1.juggling}
          area={Z1_ASF.tour1Juggling}
        />
        <ExportText value={data.asf.tour2.speed10} area={Z1_ASF.tour2Speed10} />
        <ExportText value={data.asf.tour2.speed30} area={Z1_ASF.tour2Speed30} />
        <ExportText
          value={data.asf.tour2.proAgility}
          area={Z1_ASF.tour2ProAgility}
        />
        <ExportText value={data.asf.tour2.yoyo} area={Z1_ASF.tour2Yoyo} />
        <ExportText value={data.asf.tour2.agility} area={Z1_ASF.tour2Agility} />
        <ExportText
          value={data.asf.tour2.ballControl}
          area={Z1_ASF.tour2BallControl}
        />
        <ExportText
          value={data.asf.tour2.juggling}
          area={Z1_ASF.tour2Juggling}
        />

        {TIPS_CRITERIA.map((c) => {
          const score = data.tips[c.id];
          if (score <= 0) return null;
          return (
            <ExportScore
              key={`${c.id}-score`}
              score={score}
              y={TIPS_ROW_Y[c.id]}
            />
          );
        })}

        {TIPS_GROUPS.map((g) => (
          <ExportText
            key={`grp-${g}-cmt`}
            value={data.tipsComments[g]}
            area={Z1_TIPS_GROUP_COMMENT[g]}
            size={10}
          />
        ))}

        {TIPS_GROUPS.map((g) => {
          const gAvg = groupAverage(data.tips, g);
          if (gAvg === null) return null;
          return (
            <ExportText
              key={`grp-${g}-avg`}
              value={gAvg.toFixed(2)}
              area={Z1_TIPS_GROUP_AVG[g]}
              bold
            />
          );
        })}

        <ExportText
          value={avg !== null ? avg.toFixed(2) : ""}
          area={Z1_AVERAGE}
          bold
        />
      </ExportPage>

      <ExportPage bg="/documents/evaluation/page-2.png">
        <ExportText value={data.team} area={Z2_HEADER.team} />
        <ExportText value={data.playerName} area={Z2_HEADER.playerName} />
        <ExportText value={data.birthDate} area={Z2_HEADER.birthDate} />
        <ExportText value={data.position} area={Z2_HEADER.position} />
        <ExportText
          value={data.evaluationDate}
          area={Z2_HEADER.evaluationDate}
        />

        <ExportText value={data.strengths[0]} area={Z2_STRENGTHS.line1} />
        <ExportText value={data.strengths[1]} area={Z2_STRENGTHS.line2} />
        <ExportText value={data.strengths[2]} area={Z2_STRENGTHS.line3} />

        <ExportText
          value={data.improvements[0]}
          area={Z2_IMPROVEMENTS.line1}
        />
        <ExportText
          value={data.improvements[1]}
          area={Z2_IMPROVEMENTS.line2}
        />
        <ExportText
          value={data.improvements[2]}
          area={Z2_IMPROVEMENTS.line3}
        />

        <ExportCheck
          checked={data.appreciation.includes("good")}
          area={Z2_APPRECIATION.good}
        />
        <ExportCheck
          checked={data.appreciation.includes("envisageable")}
          area={Z2_APPRECIATION.envisageable}
        />
        <ExportCheck
          checked={data.appreciation.includes("problematic")}
          area={Z2_APPRECIATION.problematic}
        />
        <ExportCheck
          checked={data.appreciation.includes("veryDifficult")}
          area={Z2_APPRECIATION.veryDifficult}
        />

        <ExportText
          value={data.signatures.technicalLead}
          area={Z2_SIGNATURES.technicalLead}
        />
        <ExportText
          value={data.signatures.coaches}
          area={Z2_SIGNATURES.coaches}
        />
        <ExportText
          value={data.signatures.parents}
          area={Z2_SIGNATURES.parents}
        />
        <ExportText value={data.signatures.date} area={Z2_SIGNATURES.date} />
      </ExportPage>
    </div>
  );
}

/* ============================================================
 * WEB FORM — flat layout, mirrors PreparationSheet's atoms
 * ============================================================ */

const inpUlClass =
  "w-full border-0 border-b border-zinc-200 bg-transparent px-0 pb-1.5 pt-0 text-[15px] font-medium text-zinc-900 outline-none transition placeholder:text-zinc-300 focus:border-[var(--g-green)]";
const inpUlSmClass =
  "w-full border-0 border-b border-zinc-200 bg-transparent px-0 pb-1 pt-0 text-[13px] font-medium text-zinc-900 outline-none transition placeholder:text-zinc-300 focus:border-[var(--g-green)]";

function FieldUl({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-1">
      {label ? (
        <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">
          {label}
        </div>
      ) : null}
      {children}
      {hint ? <span className="text-[11px] text-zinc-400">{hint}</span> : null}
    </div>
  );
}

type Patcher = (updater: (d: EvaluationData) => EvaluationData) => void;

/* Step status helpers ---------------------------------------- */

type SectionStatus = "empty" | "partial" | "complete";

function StatusDot({ status }: { status: SectionStatus }) {
  const c =
    status === "complete"
      ? "#22c55e"
      : status === "partial"
        ? "#f59e0b"
        : "#e5e7eb";
  return (
    <span
      className="block h-[7px] w-[7px] shrink-0 rounded-full"
      style={{ background: c }}
    />
  );
}

function statusFor(filled: number, total: number): SectionStatus {
  if (filled === 0) return "empty";
  if (filled >= total) return "complete";
  return "partial";
}

function computeStatuses(data: EvaluationData): SectionStatus[] {
  // Step 1 — identity + at least one stat
  const identityFields = [
    data.season,
    data.team,
    data.playerName,
    data.birthDate,
    data.position,
    data.evaluationDate,
  ].filter((s) => s.trim()).length;
  const statsFields =
    Object.values(data.stats.tour1).filter((s) => s.trim()).length +
    Object.values(data.stats.tour2).filter((s) => s.trim()).length;
  const step1Filled = identityFields + (statsFields > 0 ? 1 : 0);
  const step1: SectionStatus =
    identityFields === 0
      ? "empty"
      : step1Filled >= 5
        ? "complete"
        : "partial";

  // Step 2 — TIPS coverage
  const tipsFilled = TIPS_CRITERIA.filter(
    (c) => data.tips[c.id] > 0,
  ).length;
  const step2 = statusFor(tipsFilled, TIPS_CRITERIA.length);

  // Step 3 — bullets, appreciation, signatures
  const bulletFields = [...data.strengths, ...data.improvements].filter((s) =>
    s.trim(),
  ).length;
  const sigFields = Object.values(data.signatures).filter((s) =>
    s.trim(),
  ).length;
  const step3Total =
    bulletFields + (data.appreciation.length > 0 ? 1 : 0) + sigFields;
  const step3: SectionStatus =
    step3Total === 0
      ? "empty"
      : data.appreciation.length > 0 && bulletFields >= 2
        ? "complete"
        : "partial";

  return [step1, step2, step3];
}

/* ============================================================
 * STEPS
 * ============================================================ */

function StepIdentity({
  data,
  patch,
}: {
  data: EvaluationData;
  patch: Patcher;
}) {
  const t = useTranslations("evaluation");

  function setStat(
    tour: "tour1" | "tour2",
    key: keyof EvaluationData["stats"]["tour1"],
    v: string,
  ) {
    patch((d) => ({
      ...d,
      stats: { ...d.stats, [tour]: { ...d.stats[tour], [key]: v } },
    }));
  }
  function setAsf(
    tour: "tour1" | "tour2",
    key: keyof EvaluationData["asf"]["tour1"],
    v: string,
  ) {
    patch((d) => ({
      ...d,
      asf: { ...d.asf, [tour]: { ...d.asf[tour], [key]: v } },
    }));
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 py-1">
      {/* Identity row */}
      <section className="grid gap-x-6 gap-y-4 md:grid-cols-3">
        <FieldUl label={t("field.season")}>
          <label className="flex items-center gap-2">
            <Hash className="h-3.5 w-3.5 text-zinc-400" />
            <input
              className={inpUlClass}
              placeholder="2025-2026"
              value={data.season}
              onChange={(e) => patch((d) => ({ ...d, season: e.target.value }))}
            />
          </label>
        </FieldUl>
        <FieldUl label={t("field.team")}>
          <label className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-zinc-400" />
            <input
              className={inpUlClass}
              value={data.team}
              onChange={(e) => patch((d) => ({ ...d, team: e.target.value }))}
            />
          </label>
        </FieldUl>
        <FieldUl label={t("field.playerName")}>
          <label className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-zinc-400" />
            <input
              className={inpUlClass}
              value={data.playerName}
              onChange={(e) =>
                patch((d) => ({ ...d, playerName: e.target.value }))
              }
            />
          </label>
        </FieldUl>
        <FieldUl label={t("field.birthDate")}>
          <label className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />
            <input
              type="date"
              className={inpUlClass}
              value={data.birthDate}
              onChange={(e) =>
                patch((d) => ({ ...d, birthDate: e.target.value }))
              }
            />
          </label>
        </FieldUl>
        <FieldUl label={t("field.position")}>
          <label className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-zinc-400" />
            <input
              className={inpUlClass}
              value={data.position}
              onChange={(e) =>
                patch((d) => ({ ...d, position: e.target.value }))
              }
            />
          </label>
        </FieldUl>
        <FieldUl label={t("field.evaluationDate")}>
          <label className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />
            <input
              type="date"
              className={inpUlClass}
              value={data.evaluationDate}
              onChange={(e) =>
                patch((d) => ({ ...d, evaluationDate: e.target.value }))
              }
            />
          </label>
        </FieldUl>
      </section>

      {/* Stats — 2 columns labelled Tour 1 / Tour 2 with a left rail of labels */}
      <section>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600">
          {t("section.stats.eyebrow")}
        </div>
        <div className="grid gap-x-6 gap-y-1 md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <div className="hidden md:block" />
          <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">
            {t("section.stats.tour1")}
          </div>
          <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">
            {t("section.stats.tour2")}
          </div>
          {(
            ["matches", "playTime", "height", "weight"] as const
          ).map((key) => (
            <FlatRow
              key={key}
              label={t(`field.${key}`)}
              left={
                <input
                  type={key === "matches" || key === "playTime" ? "number" : "text"}
                  className={inpUlSmClass}
                  value={data.stats.tour1[key]}
                  onChange={(e) => setStat("tour1", key, e.target.value)}
                />
              }
              right={
                <input
                  type={key === "matches" || key === "playTime" ? "number" : "text"}
                  className={inpUlSmClass}
                  value={data.stats.tour2[key]}
                  onChange={(e) => setStat("tour2", key, e.target.value)}
                />
              }
            />
          ))}
        </div>
      </section>

      {/* ASF */}
      <section>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600">
          {t("section.asf.eyebrow")}
        </div>
        <div className="grid gap-x-6 gap-y-1 md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <div className="hidden md:block" />
          <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">
            {t("section.asf.tour1")}
          </div>
          <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">
            {t("section.asf.tour2")}
          </div>
          {(
            [
              "speed10",
              "speed30",
              "proAgility",
              "yoyo",
              "agility",
              "ballControl",
              "juggling",
            ] as const
          ).map((key) => (
            <FlatRow
              key={key}
              label={t(`field.${key}`)}
              left={
                <input
                  className={inpUlSmClass}
                  value={data.asf.tour1[key]}
                  onChange={(e) => setAsf("tour1", key, e.target.value)}
                />
              }
              right={
                <input
                  className={inpUlSmClass}
                  value={data.asf.tour2[key]}
                  onChange={(e) => setAsf("tour2", key, e.target.value)}
                />
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function FlatRow({
  label,
  left,
  right,
}: {
  label: string;
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <>
      <div className="pt-2 text-[12px] text-zinc-700 md:pt-0">{label}</div>
      <div>{left}</div>
      <div>{right}</div>
    </>
  );
}

const GROUP_COLOR: Record<TipsGroup, string> = {
  T: "#16a34a",
  I: "#2563eb",
  P: "#dc2626",
  S: "#f59e0b",
};

const SCORE_STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

function ScoreScale({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {SCORE_STEPS.map((n) => {
        const active = value === n;
        const isHalf = !Number.isInteger(n);
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(active ? 0 : n)}
            aria-pressed={active}
            className={`flex h-6 items-center justify-center rounded-[5px] tabular-nums transition ${
              isHalf ? "w-6 text-[9px]" : "w-7 text-[11px] font-semibold"
            } ${
              active
                ? "bg-zinc-950 font-semibold text-white shadow-[0_1px_2px_rgb(0_0_0/0.15)]"
                : isHalf
                  ? "text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600"
                  : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function StepTips({
  data,
  patch,
}: {
  data: EvaluationData;
  patch: Patcher;
}) {
  const t = useTranslations("evaluation");
  const avg = overallAverage(data.tips);
  function setScore(id: TipsCriterionId, score: number) {
    patch((d) => ({
      ...d,
      tips: { ...d.tips, [id]: score },
    }));
  }
  function setComment(group: TipsGroup, comment: string) {
    patch((d) => ({
      ...d,
      tipsComments: { ...d.tipsComments, [group]: comment },
    }));
  }
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 py-1">
      {/* Legend */}
      <div className="flex flex-col gap-2 border-b border-zinc-200 pb-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-zinc-400">
            {t("scaleLegend")}
          </span>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-semibold text-zinc-900">
                {n}
              </span>
              <span className="text-zinc-600">{t(`scale.${n}`)}</span>
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-baseline gap-3 text-[12px]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-zinc-400">
            {t("section.tips.average")}
          </span>
          <span className="font-mono text-[22px] font-semibold tabular-nums text-zinc-900">
            {avg !== null ? avg.toFixed(2) : "—"}
          </span>
        </div>
      </div>

      {TIPS_GROUPS.map((g) => {
        const items = TIPS_CRITERIA.filter((c) => c.group === g);
        const groupAvg = groupAverage(data.tips, g);
        return (
          <section key={g}>
            <div className="mb-2 grid w-full gap-y-6 md:grid-cols-[minmax(0,500px)_minmax(0,1fr)] md:gap-x-8">
              <div className="flex min-w-0 items-center justify-between gap-6">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white"
                    style={{ background: GROUP_COLOR[g] }}
                  >
                    {g}
                  </span>
                  <h3 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-zinc-900">
                    {t(`group.${g}`)}
                  </h3>
                </div>
                <div className="flex shrink-0 items-baseline gap-2 text-[12px]">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-zinc-400">
                    {t("section.tips.average")}
                  </span>
                  <span className="font-mono text-[15px] font-semibold tabular-nums text-zinc-900">
                    {groupAvg !== null ? groupAvg.toFixed(2) : "—"}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid w-full gap-y-6 md:grid-cols-[minmax(0,500px)_minmax(0,1fr)] md:items-stretch md:gap-x-8">
              <div className="flex flex-col">
                {items.map((c) => {
                  return (
                    <div
                      key={c.id}
                      className="grid grid-cols-1 items-center gap-x-7 gap-y-1.5 border-b border-zinc-100 py-2 md:grid-cols-[minmax(0,200px)_auto] md:justify-start"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-zinc-900">
                          {t(`criterion.${c.id}.label`)}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {t(`criterion.${c.id}.hint`)}
                        </div>
                      </div>
                      <ScoreScale
                        value={data.tips[c.id]}
                        onChange={(v) => setScore(c.id, v)}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex min-w-0 w-full">
                <FieldUl label={t("field.commentPlaceholder")}>
                  <textarea
                    value={data.tipsComments[g]}
                    onChange={(e) => setComment(g, e.target.value)}
                    placeholder={t("field.commentPlaceholder")}
                    className={`${inpUlSmClass} min-h-[96px] resize-none leading-relaxed md:h-full`}
                  />
                </FieldUl>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StepSummary({
  data,
  patch,
}: {
  data: EvaluationData;
  patch: Patcher;
}) {
  const t = useTranslations("evaluation");

  function setStrength(i: 0 | 1 | 2, v: string) {
    patch((d) => {
      const next: [string, string, string] = [...d.strengths] as [
        string,
        string,
        string,
      ];
      next[i] = v;
      return { ...d, strengths: next };
    });
  }
  function setImprovement(i: 0 | 1 | 2, v: string) {
    patch((d) => {
      const next: [string, string, string] = [...d.improvements] as [
        string,
        string,
        string,
      ];
      next[i] = v;
      return { ...d, improvements: next };
    });
  }
  function setSig(key: keyof EvaluationData["signatures"], v: string) {
    patch((d) => ({ ...d, signatures: { ...d.signatures, [key]: v } }));
  }

  function toggleAppreciation(opt: AppreciationLevel) {
    patch((d) => {
      const active = d.appreciation.includes(opt);
      return {
        ...d,
        appreciation: active
          ? d.appreciation.filter((a) => a !== opt)
          : [...d.appreciation, opt],
      };
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 py-1">
      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600">
            {t("section.bullets.strengths")}
          </div>
          <div className="flex flex-col gap-2">
            {data.strengths.map((v, i) => (
              <label key={i} className="flex items-center gap-2">
                <span className="w-4 shrink-0 font-mono text-[11px] tabular-nums text-zinc-400">
                  {i + 1})
                </span>
                <input
                  className={inpUlSmClass}
                  value={v}
                  onChange={(e) =>
                    setStrength(i as 0 | 1 | 2, e.target.value)
                  }
                />
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600">
            {t("section.bullets.improvements")}
          </div>
          <div className="flex flex-col gap-2">
            {data.improvements.map((v, i) => (
              <label key={i} className="flex items-center gap-2">
                <span className="w-4 shrink-0 font-mono text-[11px] tabular-nums text-zinc-400">
                  {i + 1})
                </span>
                <input
                  className={inpUlSmClass}
                  value={v}
                  onChange={(e) =>
                    setImprovement(i as 0 | 1 | 2, e.target.value)
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600">
          {t("section.appreciation.title")}
        </div>
        <div className="flex flex-col gap-1">
          {APPRECIATION_OPTIONS.map((opt) => {
            const active = data.appreciation.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleAppreciation(opt)}
                className={`flex w-full items-center justify-between border-b py-1.5 text-left transition ${
                  active
                    ? "border-red-500 text-zinc-950"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
                }`}
              >
                <span className="text-[13px]">{t(`appreciation.${opt}`)}</span>
                {active ? (
                  <Check className="h-4 w-4 text-red-600" strokeWidth={2.4} />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600">
          {t("section.signatures.title")}
        </div>
        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          <FieldUl label={t("field.technicalLead")}>
            <input
              className={inpUlSmClass}
              value={data.signatures.technicalLead}
              onChange={(e) => setSig("technicalLead", e.target.value)}
            />
          </FieldUl>
          <FieldUl label={t("field.coaches")}>
            <input
              className={inpUlSmClass}
              value={data.signatures.coaches}
              onChange={(e) => setSig("coaches", e.target.value)}
            />
          </FieldUl>
          <FieldUl label={t("field.parents")}>
            <input
              className={inpUlSmClass}
              value={data.signatures.parents}
              onChange={(e) => setSig("parents", e.target.value)}
            />
          </FieldUl>
          <FieldUl label={t("field.signatureDate")}>
            <input
              type="date"
              className={inpUlSmClass}
              value={data.signatures.date}
              onChange={(e) => setSig("date", e.target.value)}
            />
          </FieldUl>
        </div>
      </section>
    </div>
  );
}

/* ============================================================
 * APP SHELL
 * ============================================================ */

type EvaluationStep = { label: string; eyebrow: string; desc: string };
const STEP_COUNT = 3;

export function EvaluationSheet({
  playerId,
  evaluationId,
  locale,
  initial,
  backHref,
  teamLogos = [],
  sharedWithPlayer = false,
  sharingAvailable = true,
}: {
  playerId: string;
  evaluationId: string;
  locale: string;
  initial: EvaluationData;
  backHref: string;
  teamLogos?: string[];
  sharedWithPlayer?: boolean;
  sharingAvailable?: boolean;
}) {
  const [data, setData] = useState<EvaluationData>(initial);
  const [shared, setShared] = useState(sharedWithPlayer);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSharing, startSharingTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [stepKey, setStepKey] = useState(0);
  const stepBodyRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const t = useTranslations("evaluation");
  const tCommon = useTranslations("common");
  const { run } = useLoading();
  const messages = useMessages() as {
    evaluation: { steps: EvaluationStep[] };
  };
  const STEPS = messages.evaluation.steps;

  const patch = useCallback<Patcher>((updater) => {
    setDirty(true);
    setData(updater);
  }, []);

  const statuses = useMemo(() => computeStatuses(data), [data]);
  const completeCount = statuses.filter((s) => s === "complete").length;
  const pct = Math.round((completeCount / STEP_COUNT) * 100);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await run(
        () =>
          savePlayerEvaluationAction({
            playerId,
            evaluationId,
            locale,
            data,
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

  function handleDelete() {
    if (!confirm(t("deleteConfirm"))) return;
    setError(null);
    startTransition(async () => {
      const result = await run(
        () =>
          deletePlayerEvaluationAction({
            playerId,
            evaluationId,
            locale,
          }),
        { label: t("deleting"), message: tCommon("pleaseWait") },
      );
      if (result?.error) setError(result.error);
    });
  }

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  function toggleSharing() {
    const next = !shared;
    setError(null);
    startSharingTransition(async () => {
      const result = await run(
        () =>
          setEvaluationSharedAction({
            playerId,
            evaluationId,
            locale,
            shared: next,
          }),
        { label: t("saving"), message: tCommon("pleaseWait") },
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      setShared(next);
    });
  }

  useEffect(() => {
    if (!justSaved) return;
    const handle = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(handle);
  }, [justSaved]);

  useEffect(() => {
    stepBodyRef.current?.scrollTo({ top: 0 });
  }, [stepKey]);

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
        return <StepIdentity data={data} patch={patch} />;
      case 1:
        return <StepTips data={data} patch={patch} />;
      default:
        return <StepSummary data={data} patch={patch} />;
    }
  })();

  return (
    <>
      <div
        className="prep-no-print fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#f8f8f9] text-zinc-900"
        style={{ ["--g-green" as string]: GRINTA_GREEN }}
      >
        {/* Topbar */}
        <header className="relative z-10 flex h-[52px] flex-shrink-0 items-center justify-between border-b border-zinc-200 bg-white/95 px-5 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.push(backHref)}
              className="flex items-center gap-1 border-0 bg-transparent text-[12px] font-medium text-zinc-500 transition hover:text-zinc-950"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
              {t("back")}
            </button>
            <span className="mx-3 h-[18px] w-px bg-zinc-200" />
            <Image
              src="/documents/svg/grinta-icon.svg"
              alt=""
              width={28}
              height={28}
              priority
              className="h-7 w-7 shrink-0"
            />
            <div className="min-w-0 leading-none">
              <div className="text-[13px] font-semibold text-zinc-950">
                {t("header")}
              </div>
              <div className="mt-0.5 truncate text-[10px] text-zinc-500">
                {data.playerName || t("noPlayer")} ·{" "}
                {data.evaluationDate || t("noDate")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="mr-1 hidden items-center gap-2 rounded-lg bg-zinc-100 px-3 py-[5px] sm:flex">
              <div className="h-[3px] w-20 overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full rounded-full bg-zinc-950 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-zinc-500">
                {pct}%
              </span>
            </div>
            <button
              type="button"
              onClick={toggleSharing}
              disabled={isSharing}
              title={
                sharingAvailable
                  ? shared
                    ? t("list.unshareHint")
                    : t("list.shareHint")
                  : "Appliquez la migration shared_with_player pour modifier cette visibilité."
              }
              aria-pressed={sharingAvailable ? shared : undefined}
              className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                shared
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {shared ? (
                <Eye className="h-3.5 w-3.5" strokeWidth={2} />
              ) : (
                <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              <span className="hidden sm:inline">
                {shared ? t("list.shared") : t("list.notShared")}
              </span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition hover:bg-zinc-50 active:scale-[0.98]"
            >
              <Printer className="h-3.5 w-3.5" strokeWidth={2} />
              {t("exportPdf")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-red-200 bg-white px-3 text-[12px] font-medium text-red-600 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition hover:bg-red-50 active:scale-[0.98]"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              {t("delete")}
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
                  {dirty ? t("save") : t("upToDate")}
                </>
              )}
            </button>
          </div>
        </header>

        {/* Shell */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="hidden w-[232px] shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-white md:flex">
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
                const st = statuses[i];
                const isActive = step === i;
                const numCls = isActive
                  ? "bg-zinc-950 text-white"
                  : st === "complete"
                    ? "bg-emerald-50 text-emerald-600"
                    : st === "partial"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-zinc-100 text-zinc-400";
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={isActive ? "step" : undefined}
                    className={`group relative flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition ${
                      isActive ? "bg-zinc-50" : "hover:bg-zinc-50"
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
                            ? "text-zinc-950"
                            : "text-zinc-500 group-hover:text-zinc-900"
                        }`}
                      >
                        {s.label}
                      </span>
                    </span>
                    {!isActive && <StatusDot status={st} />}
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-zinc-200 px-4 py-3.5">
              <div className="mb-1.5 flex justify-between">
                <span className="text-[10px] text-zinc-400">
                  {t("progress")}
                </span>
                <span className="text-[10px] font-semibold text-zinc-600">
                  {pct}%
                </span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full rounded-full bg-zinc-950 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
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
                const st = statuses[i];
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
            <div className="flex shrink-0 items-center justify-between gap-4 px-7 pb-0 pt-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  {STEPS[step].eyebrow}
                </div>
                <h2 className="mt-0.5 text-[20px] font-semibold tracking-[-0.02em] text-[#0c0c0d]">
                  {STEPS[step].label}
                </h2>
                <p className="mt-0.5 max-w-[640px] text-[12px] leading-4 text-zinc-500">
                  {STEPS[step].desc}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={step === 0}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                  {t("back")}
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={step === STEPS.length - 1}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[#0c0c0d] px-3 text-[12px] font-medium text-white shadow-[0_1px_3px_rgb(0_0_0/0.15)] transition hover:bg-[#1a1a1d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
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
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-7 py-3 motion-safe:animate-[prep-step-in_180ms_cubic-bezier(0.4,0,0.2,1)]"
            >
              {stepBody}
            </div>
          </section>
        </div>
      </div>

      <PdfExport data={data} teamLogos={teamLogos} />
    </>
  );
}
