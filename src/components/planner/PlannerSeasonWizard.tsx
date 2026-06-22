"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  Fragment,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  generateSeasonSkeletonAction,
} from "@/app/[locale]/(app)/planner/[teamId]/season-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TeamCalendarSection } from "@/components/teams/TeamCalendarSection";
import { PlannerDateField } from "./PlannerSeasonCalendar";
import { THEME_COLORS, THEME_OPTIONS } from "./MicrocycleThemePicker";
import {
  isStructuringKind,
  planSeason,
  type MatchKind,
  type MdScheme,
} from "@/lib/planner/season";
import { segmentBounds } from "@/lib/planner/seasons";
import type { SeasonMatch, SeasonMicrocycle } from "./PlannerSeasonView";

type MesoDraft = {
  id: string;
  weeks: number;
  weekThemes: string[];
  name: string;
  kind: "competition" | "transition";
};
type SectionStatus = "empty" | "partial" | "complete";
type Segment = "first_round" | "second_round" | "full";
type Mode = "replace" | "merge";
type TrainingSlotDraft = {
  id: string;
  weekday: number;
  time: string;
  durationMinutes: number;
};

type Subscription = {
  id: string;
  slot: "first_round" | "second_round" | "full";
  ics_url: string;
  last_synced_at: string | null;
  last_status: string | null;
  last_error: string | null;
  event_count: number;
};

type Periodization = {
  training_weekdays: number[];
  md_scheme: string;
};

type CalendarMatch = SeasonMatch & {
  ends_at: string | null;
  match_url: string | null;
};

const DAY_MS = 86_400_000;

function localYmd(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function mondayOf(ymdValue: string): Date {
  const [y, m, d] = ymdValue.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const js = dt.getUTCDay();
  const iso = js === 0 ? 7 : js;
  return new Date(dt.getTime() - (iso - 1) * DAY_MS);
}

function weeksInclusive(startYmd: string, endYmd: string): number {
  if (!startYmd || !endYmd) return 0;
  const start = mondayOf(startYmd);
  const end = mondayOf(endYmd);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (7 * DAY_MS)) + 1);
}

/** Tour d'une semaine d'après son mois (modèle ASF) : juil→déc = 1er tour, janv→juin = 2e tour. */
function tourOfYmd(ymd: string): "first_round" | "second_round" {
  return Number(ymd.slice(5, 7)) >= 7 ? "first_round" : "second_round";
}

function statusDot(status: SectionStatus) {
  if (status === "complete") return "bg-emerald-500";
  if (status === "partial") return "bg-amber-400";
  return "bg-zinc-200";
}

function ThemeSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("planner.theme");
  const tw = useTranslations("planner.wizard");
  return (
    <Select id={id} label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{tw("noTheme")}</option>
      {THEME_OPTIONS.map((k) => (
        <option key={k} value={k}>
          {t(`option.${k}`)}
        </option>
      ))}
    </Select>
  );
}

type DraftStructure = {
  prepWeeks?: number;
  prepTheme?: string | null;
  prepWeekThemes?: (string | null)[];
  mesos?: {
    weeks?: number;
    theme?: string | null;
    weekThemes?: (string | null)[];
    name?: string | null;
    kind?: string | null;
  }[];
} | null;

export type SeasonPlanRow = {
  id: string;
  segment: Segment;
  start_date: string;
  championship_start_date: string | null;
  end_date: string;
  status: string;
  draft: {
    structure: DraftStructure;
    trainingSlots: { weekday?: number; time?: string; durationMinutes?: number }[] | null;
  } | null;
};

type SegmentDraft = {
  seasonStart: string;
  seasonEnd: string;
  prepWeekThemes: string[];
  slots: TrainingSlotDraft[];
  mesos: MesoDraft[];
};

function defaultSlots(periodization: Periodization | null): TrainingSlotDraft[] {
  const days = periodization?.training_weekdays?.length
    ? periodization.training_weekdays
    : [1, 2, 4];
  return days.map((weekday) => ({
    id: `slot-${weekday}`,
    weekday,
    time: "19:00",
    durationMinutes: 90,
  }));
}

/** État initial d'un tour : brouillon DB s'il existe, sinon défauts du segment. */
function draftFor(
  label: string,
  seg: Segment,
  plan: SeasonPlanRow | undefined,
  periodization: Periodization | null,
): SegmentDraft {
  const b = segmentBounds(label, seg);
  const structure = plan?.draft?.structure ?? null;
  const trainingSlots = plan?.draft?.trainingSlots ?? null;
  const slots =
    trainingSlots && trainingSlots.length > 0
      ? trainingSlots.map((s, i) => ({
          id: `slot-${i}-${s.weekday ?? 1}`,
          weekday: Number(s.weekday) || 1,
          time: typeof s.time === "string" ? s.time : "19:00",
          durationMinutes: Number(s.durationMinutes) || 90,
        }))
      : defaultSlots(periodization);
  const mesos =
    structure?.mesos && structure.mesos.length > 0
      ? structure.mesos.map((m, i) => {
          const weeks = Math.max(1, Math.round(Number(m.weeks) || 1));
          return {
            id: `c${i}`,
            weeks,
            weekThemes: Array.from(
              { length: weeks },
              (_, weekIndex) => m.weekThemes?.[weekIndex] ?? m.theme ?? "",
            ),
            name: m.name ?? "",
            kind: m.kind === "transition" ? ("transition" as const) : ("competition" as const),
          };
        })
      : [];
  return {
    seasonStart: plan?.start_date || b.start,
    seasonEnd: plan?.end_date || b.end,
    prepWeekThemes: Array.from(
      { length: Math.max(0, Math.round(Number(structure?.prepWeeks) || 0)) },
      (_, index) => structure?.prepWeekThemes?.[index] ?? structure?.prepTheme ?? "",
    ),
    slots,
    mesos,
  };
}

export function PlannerSeasonWizard({
  teamId,
  initialSeasonLabel,
  initialSegment = "full",
  matches,
  archivedMatches = [],
  subscriptions,
  periodization,
  seasonPlans = [],
  existingMicrocycles = [],
  generated,
  onClose,
}: {
  teamId: string;
  initialSeasonLabel: string | null;
  initialSegment?: Segment;
  matches: CalendarMatch[];
  archivedMatches?: CalendarMatch[];
  subscriptions: Subscription[];
  periodization: Periodization | null;
  seasonPlans?: SeasonPlanRow[];
  existingMicrocycles?: SeasonMicrocycle[];
  generated: boolean;
  onClose?: () => void;
}) {
  const t = useTranslations("planner.wizard");
  const tTheme = useTranslations("planner.theme");
  const locale = useLocale();
  const router = useRouter();
  const stepBodyRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [stepKey, setStepKey] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [segment, setSegment] = useState<Segment>(initialSegment);
  const [lastPlanningSegment, setLastPlanningSegment] = useState<
    "first_round" | "second_round"
  >(initialSegment === "second_round" ? "second_round" : "first_round");
  const mode: Mode = generated ? "merge" : "replace";
  const [seasonLabel] = useState(
    initialSeasonLabel ||
      `${new Date().getFullYear()}/${String((new Date().getFullYear() + 1) % 100).padStart(2, "0")}`,
  );
  const planName = "";

  // Brouillon par tour : prefill depuis la DB (season_plans + draft). `initialDrafts`
  // est un state stable (calculé une fois) ; `draftsRef` en tient une copie mutable
  // pour persister les saisies au changement de tour (switchFrame) sans re-render.
  const [initialDrafts] = useState<Record<Segment, SegmentDraft>>(() => {
    const bySeg = new Map<Segment, SeasonPlanRow>();
    for (const p of seasonPlans) bySeg.set(p.segment, p);
    return {
      first_round: draftFor(seasonLabel, "first_round", bySeg.get("first_round"), periodization),
      second_round: draftFor(seasonLabel, "second_round", bySeg.get("second_round"), periodization),
      full: draftFor(seasonLabel, "full", bySeg.get("full"), periodization),
    };
  });
  const draftsRef = useRef<Record<Segment, SegmentDraft>>(initialDrafts);
  const initial = initialDrafts[segment];
  const [seasonStart, setSeasonStart] = useState(initial.seasonStart);
  const [seasonEnd, setSeasonEnd] = useState(initial.seasonEnd);
  const [prepWeekThemes, setPrepWeekThemes] = useState(initial.prepWeekThemes);
  const [slots, setSlots] = useState<TrainingSlotDraft[]>(initial.slots);
  const [mesos, setMesos] = useState<MesoDraft[]>(initial.mesos);
  const bounds = segmentBounds(seasonLabel, segment);

  useEffect(() => {
    stepBodyRef.current?.scrollTo({ top: 0 });
  }, [stepKey]);

  // La numérotation reste stable dans le temps : les matchs officiels déjà joués
  // et archivés comptent autant que les matchs encore présents dans l'ICS actif.
  const officialMatches = Array.from(
    new Map([...matches, ...archivedMatches].map((m) => [m.id, m])).values(),
  ).filter((m) => isStructuringKind(m.kind));
  function officialMatchesInBounds(start: string, end: string) {
    return officialMatches.filter((m) => {
      const d = localYmd(m.starts_at);
      return Boolean(d) && d >= start && d <= end;
    });
  }
  function prepWeeksFor(start: string, end: string) {
    const first = officialMatchesInBounds(start, end)
      .map((m) => localYmd(m.starts_at))
      .sort((a, b) => a.localeCompare(b))[0];
    if (!start || !first) return 0;
    return Math.max(
      0,
      Math.round((mondayOf(first).getTime() - mondayOf(start).getTime()) / (7 * DAY_MS)),
    );
  }
  const prepWeeks = prepWeeksFor(seasonStart, seasonEnd);

  // Matchs officiels du tour sélectionné. On ne peut générer un tour que s'il a
  // ses matchs (sinon : calendrier pas à jour ou mauvais tour) — garde-fou non
  // destructif : bouton « Générer » désactivé + message, rien n'est supprimé.
  const inFrameOfficialMatches = officialMatchesInBounds(seasonStart, seasonEnd);
  const noMatchesForTour = inFrameOfficialMatches.length === 0;

  const totalWeeks = weeksInclusive(seasonStart, seasonEnd);
  const workWeeks = Math.max(0, totalWeeks - prepWeeks);
  const assignedWeeks = mesos.reduce((sum, m) => sum + (m.weeks || 0), 0);
  const definedWeeks = Math.min(
    workWeeks,
    assignedWeeks,
  );
  const remainingWeeks = Math.max(0, workWeeks - assignedWeeks);

  const statuses: SectionStatus[] = [
    segment ? "complete" : "partial",
    seasonStart && seasonEnd && slots.length > 0 && mesos.length > 0 && definedWeeks > 0
      ? "complete"
      : "partial",
    "complete",
  ];
  const pct = Math.round((statuses.filter((s) => s === "complete").length / statuses.length) * 100);

  const steps = [
    { label: t("steps.calendar"), eyebrow: t("eyebrow.calendar") },
    { label: t("steps.plan"), eyebrow: t("eyebrow.plan") },
    { label: t("steps.summary"), eyebrow: t("eyebrow.summary") },
  ];

  function goTo(i: number) {
    // « Saison complète » est une vue d'agrégation du résumé, jamais un plan à
    // éditer. En revenant à Planification, on restaure le dernier tour utilisé.
    if (i === 1 && segment === "full") {
      switchFrame(lastPlanningSegment);
    }
    setStep(i);
    setStepKey((k) => k + 1);
  }

  function switchFrame(nextSegment: Segment) {
    if (nextSegment === segment) return;
    // Sauvegarde les saisies du tour courant avant de basculer.
    draftsRef.current[segment] = { seasonStart, seasonEnd, prepWeekThemes, slots, mesos };
    const next = draftsRef.current[nextSegment];
    setSegment(nextSegment);
    if (nextSegment !== "full" && step < 2) setLastPlanningSegment(nextSegment);
    setSeasonStart(next.seasonStart);
    setSeasonEnd(next.seasonEnd);
    setPrepWeekThemes(next.prepWeekThemes);
    setSlots(next.slots);
    setMesos(next.mesos);
  }

  function addSlot() {
    setSlots((prev) => [
      ...prev,
      { id: `slot-${Date.now()}`, weekday: 1, time: "19:00", durationMinutes: 90 },
    ]);
  }

  function updateSlot(id: string, patch: Partial<TrainingSlotDraft>) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSlot(id: string) {
    setSlots((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
  }

  function addMeso() {
    const assigned = mesos.reduce((sum, meso) => sum + meso.weeks, 0);
    const weeks = Math.max(1, Math.min(4, workWeeks - assigned || 1));
    setMesos((prev) => [
      ...prev,
      {
        id: `c${Date.now()}`,
        weeks,
        weekThemes: Array.from({ length: weeks }, () => ""),
        name: "",
        kind: "competition",
      },
    ]);
  }

  function updateMeso(id: string, patch: Partial<MesoDraft>) {
    setMesos((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function updateMesoWeeks(id: string, weeks: number) {
    setMesos((prev) =>
      prev.map((meso) =>
        meso.id === id
          ? {
              ...meso,
              weeks,
              weekThemes: Array.from(
                { length: weeks },
                (_, index) => meso.weekThemes[index] ?? "",
              ),
            }
          : meso,
      ),
    );
  }

  function updateWeekTheme(id: string, weekIndex: number, theme: string) {
    setMesos((prev) =>
      prev.map((meso) =>
        meso.id === id
          ? {
              ...meso,
              weekThemes: meso.weekThemes.map((value, index) =>
                index === weekIndex ? theme : value,
              ),
            }
          : meso,
      ),
    );
  }

  function updatePrepWeekTheme(weekIndex: number, theme: string) {
    setPrepWeekThemes((current) =>
      Array.from({ length: prepWeeks }, (_, index) =>
        index === weekIndex ? theme : current[index] ?? "",
      ),
    );
  }

  function removeMeso(id: string) {
    setMesos((prev) => prev.filter((m) => m.id !== id));
  }

  function buildAndGenerate(seg: Segment, start: string, end: string) {
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("locale", locale);
    fd.set("mode", mode);
    fd.set("segment", seg);
    fd.set("seasonLabel", seasonLabel.trim());
    fd.set("planName", planName.trim());
    fd.set("seasonStart", start);
    fd.set("seasonEnd", end);
    fd.set(
      "trainingSlots",
      JSON.stringify(
        slots.map((s) => ({
          weekday: s.weekday,
          time: s.time,
          durationMinutes: s.durationMinutes,
        })),
      ),
    );
    fd.set(
      "structure",
      JSON.stringify({
        prepWeeks: prepWeeksFor(start, end),
        prepWeekThemes: Array.from(
          { length: prepWeeksFor(start, end) },
          (_, index) => prepWeekThemes[index] || null,
        ),
        mesos: mesos.map((m) => ({
          weeks: m.weeks,
          weekThemes: m.weekThemes.map((theme) => theme || null),
          name: m.name.trim() || null,
          kind: m.kind,
        })),
      }),
    );

    startTransition(async () => {
      setMsg(null);
      const r = await generateSeasonSkeletonAction(fd);
      if (r?.error) {
        setMsg({ ok: false, text: t.has(`err.${r.error}`) ? t(`err.${r.error}`) : r.error });
      } else {
        setMsg({
          ok: true,
          text: t("generated", { micro: r.microcycles ?? 0, sessions: r.sessions ?? 0 }),
        });
        router.refresh();
      }
    });
  }

  function generate() {
    if (noMatchesForTour) return;
    const savedPlan = seasonPlans.find((plan) => plan.segment === segment);
    const savedStructure = savedPlan?.draft?.structure;
    const savedSlots = savedPlan?.draft?.trainingSlots ?? [];
    const structuralChange = Boolean(
      savedPlan &&
        (savedPlan.start_date !== seasonStart ||
          savedPlan.end_date !== seasonEnd ||
          Number(savedStructure?.prepWeeks ?? -1) !== prepWeeks ||
          (savedStructure?.mesos?.length ?? 0) !== mesos.length ||
          mesos.some((meso, index) => {
            const saved = savedStructure?.mesos?.[index];
            return (
              Number(saved?.weeks ?? -1) !== meso.weeks ||
              (saved?.kind === "transition" ? "transition" : "competition") !== meso.kind
            );
          }) ||
          JSON.stringify(
            savedSlots.map((slot) => ({
              weekday: Number(slot.weekday),
              time: slot.time ?? "19:00",
              durationMinutes: Number(slot.durationMinutes) || 90,
            })),
          ) !==
            JSON.stringify(
              slots.map((slot) => ({
                weekday: slot.weekday,
                time: slot.time,
                durationMinutes: slot.durationMinutes,
              })),
            ))
    );
    if (
      structuralChange &&
      !window.confirm(
        t.has("structuralChangeConfirm")
          ? t("structuralChangeConfirm")
          : "Les dates, cycles ou créneaux ont fortement changé. Les semaines et séances vont être recalculées. Continuer ?",
      )
    ) return;
    buildAndGenerate(segment, seasonStart, seasonEnd);
  }

  const body: ReactNode = (() => {
    switch (step) {
      case 0:
        return (
          <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 py-1">
            <section className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600">
                  {t("eyebrow.calendar")}
                </div>
                <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[#0c0c0d]">
                  {t("calendarTitle")}
                </h2>
                <p className="mt-0.5 max-w-[620px] text-[12px] leading-4 text-zinc-500">
                  {t("calendarSubtitle")}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  {t("seasonLabel")}
                </div>
                <div className="mt-0.5 text-sm font-semibold text-zinc-950">
                  {seasonLabel}
                </div>
              </div>
            </section>

            <TeamCalendarSection
              teamId={teamId}
              season={seasonLabel}
              subscriptions={subscriptions}
              matches={matches}
              archivedMatches={archivedMatches}
              periodization={periodization}
              variant="plain"
              showPeriodization={false}
              activeSlot={segment}
              frameStart={seasonStart}
              frameEnd={seasonEnd}
              onSwitchFrame={switchFrame}
            />
          </div>
        );
      case 1:
        return (
          <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 py-1">
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  {t("tourLabel")}
                </div>
                <div className="text-[11px] font-semibold text-zinc-950">{seasonLabel}</div>
              </div>
              {/* Planification au niveau du tour — la saison complète se
                  consulte/génère depuis le Résumé. */}
              <div className="grid max-w-xs grid-cols-2 gap-1">
                {(["first_round", "second_round"] as const).map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => switchFrame(seg)}
                    className={`h-7 border-b text-center text-[11px] font-semibold transition ${
                      segment === seg
                        ? "border-red-500 text-zinc-950"
                        : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    {t(`segment.${seg}`)}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                {t("boundsTitle")}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <PlannerDateField
                  id="season-start"
                  label={t("seasonStart")}
                  value={seasonStart}
                  matches={matches}
                  frameStart={seasonStart}
                  frameEnd={seasonEnd}
                  minYmd={bounds.start}
                  maxYmd={bounds.end}
                  hint={t("outOfSeasonRange")}
                  onChange={setSeasonStart}
                />
                <PlannerDateField
                  id="season-end"
                  label={t("seasonEnd")}
                  value={seasonEnd}
                  matches={matches}
                  frameStart={seasonStart}
                  frameEnd={seasonEnd}
                  minYmd={bounds.start}
                  maxYmd={bounds.end}
                  hint={t("outOfSeasonRange")}
                  onChange={setSeasonEnd}
                />
                <Input
                  id="prep-weeks"
                  type="number"
                  label={t("prepWeeks")}
                  value={prepWeeks}
                  readOnly
                  hint={t("prepWeeksHint")}
                />
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  {t("rhythmTitle")}
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addSlot}>
                  <Plus className="h-3.5 w-3.5" />
                  {t("addSlot")}
                </Button>
              </div>
              <ul className="flex flex-col gap-2">
                {slots.map((slot) => (
                  <li
                    key={slot.id}
                    className="grid gap-2 border-t border-zinc-200 py-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <Select
                      id={`slot-day-${slot.id}`}
                      label={t("weekday")}
                      value={String(slot.weekday)}
                      onChange={(e) => updateSlot(slot.id, { weekday: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <option key={d} value={d}>
                          {t(`weekdayOption.${d}`)}
                        </option>
                      ))}
                    </Select>
                    <Input
                      id={`slot-time-${slot.id}`}
                      type="time"
                      label={t("slotTime")}
                      value={slot.time}
                      onChange={(e) => updateSlot(slot.id, { time: e.target.value })}
                    />
                    <Input
                      id={`slot-duration-${slot.id}`}
                      type="number"
                      min={15}
                      max={240}
                      label={t("duration")}
                      value={slot.durationMinutes}
                      onChange={(e) =>
                        updateSlot(slot.id, {
                          durationMinutes: Math.max(15, Math.min(240, Number(e.target.value) || 90)),
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeSlot(slot.id)}
                      className="self-end rounded-[8px] p-2 text-zinc-400 transition hover:bg-white hover:text-red-600"
                      title={t("removeSlot")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                    {t("cyclesTitle")}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {t("coverage", { defined: definedWeeks, total: workWeeks })}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{t("cyclesHint")}</div>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addMeso}>
                  <Plus className="h-3.5 w-3.5" />
                  {t("addCycle")}
                </Button>
              </div>
              {prepWeeks > 0 ? (
                <div className="mb-3 rounded-[12px] border border-sky-200 bg-sky-50/50 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-600">
                    {t("prepCycleTitle")}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {t("prepCycleRange", { start: -prepWeeks, end: -1 })}
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: prepWeeks }, (_, weekIndex) => {
                      const theme = prepWeekThemes[weekIndex] ?? "";
                      const dot = theme
                        ? THEME_COLORS[theme as keyof typeof THEME_COLORS]?.dot
                        : "#d4d4d8";
                      return (
                        <div
                          key={`prep-week-${weekIndex}`}
                          className="rounded-[8px] border border-sky-100 bg-white p-2"
                        >
                          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700">
                            <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
                            {t("weekBadge", { n: weekIndex - prepWeeks })}
                          </div>
                          <ThemeSelect
                            id={`prep-week-theme-${weekIndex}`}
                            label={t("theme")}
                            value={theme}
                            onChange={(value) => updatePrepWeekTheme(weekIndex, value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <ul className="flex flex-col gap-2">
                {mesos.map((m, idx) => {
                  const firstWeek =
                    mesos.slice(0, idx).reduce((sum, cycle) => sum + cycle.weeks, 0) + 1;
                  return (
                    <li
                      key={m.id}
                      className="rounded-[12px] border border-zinc-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                            {t("cycleNumber", { n: idx + 1 })}
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-500">
                            {t("cycleRange", { start: firstWeek, end: firstWeek + m.weeks - 1 })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMeso(m.id)}
                          className="rounded-[8px] p-2 text-zinc-400 transition hover:bg-zinc-50 hover:text-red-600"
                          title={t("removeCycle")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_1fr_0.6fr]">
                        <Input
                          id={`cycle-name-${m.id}`}
                          label={t("cycleName")}
                          value={m.name}
                          placeholder={t("cyclePlaceholder", { n: idx + 1 })}
                          onChange={(e) => updateMeso(m.id, { name: e.target.value })}
                        />
                        <Select
                          id={`cycle-kind-${m.id}`}
                          label={t("cycleType")}
                          value={m.kind}
                          onChange={(e) =>
                            updateMeso(m.id, {
                              kind: e.target.value === "transition" ? "transition" : "competition",
                            })
                          }
                        >
                          <option value="competition">{t("cycleTypeOption.competition")}</option>
                          <option value="transition">{t("cycleTypeOption.transition")}</option>
                        </Select>
                        <Input
                          id={`cycle-weeks-${m.id}`}
                          type="number"
                          min={1}
                          max={Math.max(1, workWeeks)}
                          label={t("weeks")}
                          value={m.weeks}
                          onChange={(e) =>
                            updateMesoWeeks(
                              m.id,
                              Math.max(
                                1,
                                Math.min(Math.max(1, workWeeks), Number(e.target.value) || 1),
                              ),
                            )
                          }
                        />
                      </div>

                      <div className="mt-4 border-t border-zinc-100 pt-3">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                          {t("weeklyThemes")}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {m.weekThemes.map((theme, weekIndex) => {
                            const dot = theme
                              ? THEME_COLORS[theme as keyof typeof THEME_COLORS]?.dot
                              : "#d4d4d8";
                            return (
                              <div
                                key={`${m.id}-week-${weekIndex}`}
                                className="rounded-[8px] border border-zinc-100 bg-zinc-50 p-2"
                              >
                                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-700">
                                  <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
                                  {t("weekBadge", { n: firstWeek + weekIndex })}
                                </div>
                                <ThemeSelect
                                  id={`cycle-theme-${m.id}-${weekIndex}`}
                                  label={t("theme")}
                                  value={theme}
                                  onChange={(value) => updateWeekTheme(m.id, weekIndex, value)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {mesos.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-zinc-300 px-4 py-5 text-center text-sm text-zinc-500">
                  {t("cyclesEmpty", { n: workWeeks })}
                </div>
              ) : null}
              <div className="mt-3 text-xs font-medium text-zinc-600">
                {remainingWeeks > 0
                  ? t("weeksRemaining", { n: remainingWeeks })
                  : assignedWeeks > workWeeks
                    ? t("weeksOverflow", { n: assignedWeeks - workWeeks })
                    : t("weeksComplete")}
              </div>
            </section>
          </div>
        );
      default: {
        // Aperçu = exactement ce que la génération produira : on reproduit la
        // logique pure `planSeason` avec les mêmes matchs officiels du cadre.
        const matchById = new Map(
          [...matches, ...archivedMatches].map((m) => [m.id, m] as const),
        );
        const planSegmentById = new Map(seasonPlans.map((plan) => [plan.id, plan.segment]));
        const isFullAggregate = segment === "full";
        const previewPlan =
          !isFullAggregate && inFrameOfficialMatches.length > 0
            ? planSeason(
                inFrameOfficialMatches.map((m) => ({
                  id: m.id,
                  startsAt: new Date(m.starts_at),
                  kind: (m.kind as MatchKind | null) ?? "league",
                })),
                {
                  trainingWeekdays: periodization?.training_weekdays?.length
                    ? periodization.training_weekdays
                    : [2, 4],
                  mdScheme: (periodization?.md_scheme as MdScheme | null) ?? "standard",
                },
                {
                  seasonStart,
                  seasonEnd,
                  structure: {
                    prepWeeks,
                    prepWeekThemes: Array.from(
                      { length: prepWeeks },
                      (_, index) => prepWeekThemes[index] || null,
                    ),
                    mesos: mesos.map((m) => ({
                      weeks: m.weeks,
                      weekThemes: m.weekThemes.map((theme) => theme || null),
                      name: m.name.trim() || null,
                      kind: m.kind,
                    })),
                  },
                  trainingSlots: slots.map((s) => ({
                    weekday: s.weekday,
                    time: s.time,
                    durationMinutes: s.durationMinutes,
                  })),
                },
              )
            : null;
        const weeks = isFullAggregate
          ? existingMicrocycles
              .filter((microcycle) => {
                const planSegment = planSegmentById.get(microcycle.seasonPlanId);
                return planSegment === "first_round" || planSegment === "second_round";
              })
              .map((microcycle) => ({
                startDate: microcycle.startDate,
                weekNumber: microcycle.weekNumber,
                phase: microcycle.kind === "preparation" ? "preparation" as const :
                  microcycle.kind === "transition" ? "transition" as const : "competition" as const,
                theme: microcycle.theme,
                targetMatchId: microcycle.targetMatchId,
                sessions: microcycle.sessions,
              }))
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
          : previewPlan?.microcycles ?? [];
        const totalSessions = weeks.reduce((sum, w) => sum + w.sessions.length, 0);
        const prepCount = weeks.filter((w) => w.phase === "preparation").length;
        const compCount = weeks.filter((w) => w.phase === "competition").length;
        const matchWeeks = weeks.filter((w) => w.targetMatchId).length;

        return (
          <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-7 py-1">
            {/* Trois vues : 1er tour / 2e tour / saison complète */}
            <div className="grid max-w-md grid-cols-3 gap-1">
              {(["first_round", "second_round", "full"] as const).map((seg) => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => switchFrame(seg)}
                  className={`h-7 border-b text-center text-[11px] font-semibold transition ${
                    segment === seg
                      ? "border-red-500 text-zinc-950"
                      : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
                  }`}
                >
                  {t(`segment.${seg}`)}
                </button>
              ))}
            </div>

            {/* Vue d'ensemble : une case par semaine */}
            <section>
              <div className="mb-3 flex items-center justify-between border-b border-zinc-200 pb-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  {t("gridTitle")}
                </div>
                <div className="text-xs text-zinc-500">
                  {t("weekN", { n: weeks.length })} · {t(`segment.${segment}`)}
                </div>
              </div>
              {weeks.length === 0 ? (
                <p className="py-4 text-sm text-zinc-500">
                  {isFullAggregate ? t("fullAggregateEmpty") : t("gridEmpty")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-[10px] border border-zinc-200">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="bg-zinc-50 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                        <th className="w-12 border-b border-zinc-200 px-2.5 py-2">{t("col.week")}</th>
                        <th className="border-b border-l border-zinc-200 px-2.5 py-2">{t("col.date")}</th>
                        <th className="border-b border-l border-zinc-200 px-2.5 py-2">{t("col.phase")}</th>
                        <th className="border-b border-l border-zinc-200 px-2.5 py-2">{t("col.theme")}</th>
                        <th className="border-b border-l border-zinc-200 px-2.5 py-2">{t("col.trainings")}</th>
                        <th className="border-b border-l border-zinc-200 px-2.5 py-2">{t("col.match")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeks.map((w, idx) => {
                        const theme = w.theme;
                        const dot =
                          theme && THEME_COLORS[theme as keyof typeof THEME_COLORS]
                            ? THEME_COLORS[theme as keyof typeof THEME_COLORS].dot
                            : "#d4d4d8";
                        const match = w.targetMatchId ? matchById.get(w.targetMatchId) : null;
                        // En vue saison complète : bande de section au changement
                        // de tour (automne → 1er tour, printemps → 2e tour).
                        const tour = tourOfYmd(w.startDate);
                        const showTourHeader =
                          segment === "full" &&
                          (idx === 0 || tourOfYmd(weeks[idx - 1].startDate) !== tour);
                        return (
                          <Fragment key={w.startDate}>
                            {showTourHeader ? (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="border-y border-zinc-200 bg-zinc-100 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-600"
                                >
                                  {t(`segment.${tour}`)}
                                </td>
                              </tr>
                            ) : null}
                            <WeekRow
                              n={w.weekNumber}
                              startDate={w.startDate}
                              themeLabel={theme ? tTheme(`option.${theme}`) : t("noTheme")}
                              dot={dot}
                              phaseLabel={t(`phase.${w.phase}`)}
                              sessions={w.sessions}
                              matchName={match ? match.summary ?? match.opponent ?? null : null}
                              locale={locale}
                              t={t}
                            />
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Statistiques clés */}
            <section>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                {t("statsTitle")}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <Stat label={t("statWeeks")} value={weeks.length} />
                <Stat label={t("statPrep")} value={prepCount} />
                <Stat label={t("statComp")} value={compCount} />
                <Stat label={t("statMatches")} value={matchWeeks} />
                <Stat label={t("statSessions")} value={totalSessions} />
              </div>
            </section>

            {msg ? (
              <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
                {msg.text}
              </p>
            ) : null}
          </div>
        );
      }
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#f8f8f9] text-zinc-900">
      <header className="relative z-10 flex h-[52px] items-center justify-between border-b border-zinc-200 bg-white/95 px-5 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onClose ?? (() => router.back())}
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
            <div className="flex items-center gap-2 text-[13px] font-semibold text-zinc-950">
              <CalendarDays className="h-3.5 w-3.5 text-red-500" />
              {t("title")}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-zinc-500">
              {t("subtitle")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="mr-1 hidden items-center gap-2 rounded-lg bg-zinc-100 px-3 py-[5px] sm:flex">
            <div className="h-[3px] w-20 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full rounded-full bg-zinc-950" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-zinc-500">{pct}%</span>
          </div>
          {/* Les deux boutons enregistrent le plan réel : Saison et Hebdo lisent
              ensuite les mêmes microcycles. */}
          {step === 1 ? (
            <button
              type="button"
              onClick={generate}
              disabled={isPending || noMatchesForTour || !seasonStart || !seasonEnd}
              className="inline-flex h-8 min-w-[112px] items-center justify-center gap-1.5 rounded-[8px] border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-60"
            >
              {isPending ? (
                t("savingDates")
              ) : (
                <>
                  <Save className="h-3 w-3" />
                  {t("saveDates")}
                </>
              )}
            </button>
          ) : step === steps.length - 1 && segment !== "full" ? (
            <button
              type="button"
              onClick={generate}
              disabled={isPending || noMatchesForTour || !seasonStart || !seasonEnd}
              className="inline-flex h-8 min-w-[112px] items-center justify-center gap-1.5 rounded-[8px] border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-60"
            >
              {isPending ? (
                t("savingDates")
              ) : (
                <>
                  <Save className="h-3 w-3" />
                  {t("saveDates")}
                </>
              )}
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-[232px] shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-white md:flex">
          <div className="px-4 pb-2 pt-4 text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
            {t("stepsLabel")}
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
            {steps.map((s, i) => {
              const isActive = step === i;
              const st = statuses[i];
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={isActive ? "step" : undefined}
                  className={`group relative flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition ${
                    isActive ? "bg-zinc-50" : "hover:bg-zinc-50"
                  }`}
                >
                  {isActive ? (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-red-500" />
                  ) : null}
                  <span
                    className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-[11px] font-semibold ${
                      isActive
                        ? "bg-zinc-950 text-white"
                        : st === "complete"
                          ? "bg-emerald-50 text-emerald-600"
                          : st === "partial"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-zinc-100 text-zinc-400"
                    }`}
                  >
                    {st === "complete" && !isActive ? (
                      <Check className="h-[11px] w-[11px]" strokeWidth={3} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] font-medium leading-tight text-zinc-600 group-hover:text-zinc-950">
                    {s.label}
                  </span>
                  {!isActive ? <span className={`h-[7px] w-[7px] rounded-full ${statusDot(st)}`} /> : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-zinc-200 bg-white px-4 py-2.5 md:hidden">
            {steps.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => goTo(i)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium ${
                  step === i
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700"
                }`}
              >
                {i + 1}. {s.label}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-4 px-7 pb-0 pt-2">
            <div className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
              {steps[step].eyebrow}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => goTo(Math.max(0, step - 1))}
                disabled={step === 0}
                className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition hover:bg-zinc-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t("back")}
              </button>
              <button
                type="button"
                onClick={() => goTo(Math.min(steps.length - 1, step + 1))}
                disabled={step === steps.length - 1}
                className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[#0c0c0d] px-3 text-[12px] font-medium text-white shadow-[0_1px_3px_rgb(0_0_0/0.15)] transition hover:bg-[#1a1a1d] disabled:opacity-40"
              >
                {t("next")}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {msg && step !== steps.length - 1 ? (
            <div className={`shrink-0 border-b px-7 py-2.5 text-[12px] ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
              {msg.text}
            </div>
          ) : noMatchesForTour ? (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-7 py-2.5 text-[12px] text-amber-800">
              {t("noMatchesForTour", { tour: t(`segment.${segment}`) })}
            </div>
          ) : null}

          <div
            ref={stepBodyRef}
            key={stepKey}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-7 py-3"
          >
            {body}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] border border-zinc-200 bg-white px-3 py-2.5">
      <div className="text-2xl font-semibold tabular-nums leading-none text-zinc-950">{value}</div>
      <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
        {label}
      </div>
    </div>
  );
}

/** Une ligne de tableau par semaine : n°, date, phase, thème, entraînements, match. */
function WeekRow({
  n,
  startDate,
  themeLabel,
  dot,
  phaseLabel,
  sessions,
  matchName,
  locale,
  t,
}: {
  n: number;
  startDate: string;
  themeLabel: string;
  dot: string;
  phaseLabel: string;
  sessions: { date: string; startTime: string | null; mdOffset: number | null }[];
  matchName: string | null;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const dateStr = new Date(`${startDate}T00:00:00`).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  });
  const td = "border-b border-l border-zinc-100 px-2.5 py-1.5 align-middle";
  return (
    <tr className="text-zinc-700 odd:bg-white even:bg-zinc-50/50 hover:bg-red-50/40">
      <td className="border-b border-zinc-100 px-2.5 py-1.5 align-middle font-semibold text-zinc-900">
        {t("weekBadge", { n })}
      </td>
      <td className={`${td} whitespace-nowrap capitalize`}>{dateStr}</td>
      <td className={`${td} whitespace-nowrap text-zinc-500`}>{phaseLabel}</td>
      <td className={td}>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
          <span className="truncate">{themeLabel}</span>
        </span>
      </td>
      <td className={td}>
        {sessions.length === 0 ? (
          <span className="text-zinc-300">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {sessions.map((s, i) => (
              <span
                key={`${s.date}-${i}`}
                className="inline-flex items-center gap-1 rounded-[5px] bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-zinc-600"
              >
                {new Date(`${s.date}T00:00:00`).toLocaleDateString(locale, { weekday: "short" })}
              </span>
            ))}
          </span>
        )}
      </td>
      <td className={`${td} ${matchName ? "font-medium text-red-600" : "text-zinc-300"}`}>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {matchName ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" /> : null}
          <span className="truncate">{matchName ?? "—"}</span>
        </span>
      </td>
    </tr>
  );
}
