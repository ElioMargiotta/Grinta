/**
 * Générateur de squelette de saison — LOGIQUE PURE (aucun I/O, aucun accès DB).
 *
 * Modèle « tactical periodization / MD± » unifié avec la périodisation classique :
 * la saison est découpée en SEMAINES calendaires (microcycles, début lundi),
 * groupées en PHASES (mésocycles : Préparation / Compétition / Transition).
 * Chaque semaine qui contient un match d'ancrage « cible » ce match et ses jours
 * d'entraînement sont étiquetés par leur écart au jour J (`mdOffset`).
 *
 * Le générateur (server action) écrit ce plan dans macro/méso/micro — le même
 * modèle que lit la vue Hebdomadaire — pour que tout soit cohérent entre les vues
 * (Saison, Hebdo) et que les thèmes posés sur les microcycles s'affichent partout.
 *
 * Convention dates : `starts_at` des matchs = instants UTC. On raisonne en dates
 * civiles locales (Europe/Zurich par défaut) projetées sur minuit UTC, pour une
 * arithmétique de jours/semaines insensible au DST.
 */

export type MatchKind = "league" | "cup" | "friendly" | "tournament" | "break";

export type AnchorMatch = {
  id: string;
  startsAt: Date;
  isAnchor: boolean;
  kind?: MatchKind;
};

export type MdScheme = "standard" | "congested" | "custom";

export type PeriodizationSettings = {
  /** Jours d'entraînement, ISO 1=lundi … 7=dimanche. */
  trainingWeekdays: number[];
  mdScheme: MdScheme;
};

export type TrainingSlot = {
  /** ISO 1=lundi … 7=dimanche. */
  weekday: number;
  /** `HH:mm`. */
  time: string;
  /** Durée en minutes. */
  durationMinutes: number;
};

/** Structure saisie au wizard : phase prépa + une liste de mésocycles (cycles). */
export type SeasonStructure = {
  /** Nb de semaines de préparation avant le 1er match. */
  prepWeeks: number;
  /** Thème (phase de jeu) appliqué par défaut aux semaines de prépa. */
  prepTheme?: string | null;
  /** Mésocycles de compétition, dans l'ordre. */
  mesos: { weeks: number; theme?: string | null; name?: string | null }[];
};

export type PlanOptions = {
  timeZone?: string;
  /** Date de reprise (début préparation, `YYYY-MM-DD`). Défaut = 4 sem. avant le 1er match. */
  seasonStart?: string;
  /** Date de fin du périmètre planifié, `YYYY-MM-DD`. Défaut = dernier match. */
  seasonEnd?: string;
  /** Nb de semaines de préparation par défaut quand seasonStart absent. */
  prepWeeks?: number;
  /** Mode wizard : découpe explicite en prépa + mésocycles. Prioritaire sur seasonStart/prepWeeks. */
  structure?: SeasonStructure;
  /** Slots précis issus du wizard. Prioritaire sur `settings.trainingWeekdays`. */
  trainingSlots?: TrainingSlot[];
};

export type PhaseKind = "preparation" | "competition" | "transition";

export type PlannedSession = {
  /** Date locale `YYYY-MM-DD`. */
  date: string;
  /** Heure locale `HH:mm`. */
  startTime: string | null;
  /** Durée en minutes. */
  durationMinutes: number | null;
  /** Écart en jours au match de la semaine (négatif = avant). null = semaine sans match. */
  mdOffset: number | null;
};

export type PlannedMicrocycle = {
  /** 0-based, ordre chronologique sur toute la saison. */
  index: number;
  /** Lundi de la semaine, `YYYY-MM-DD`. */
  startDate: string;
  /** Négatif en préparation, 1.. en compétition (convention héritée du wizard). */
  weekNumber: number;
  phase: PhaseKind;
  /** Index dans `phases` (un mésocycle = une phase). */
  phaseIndex: number;
  targetMatchId: string | null;
  sessions: PlannedSession[];
};

export type PlannedPhase = {
  kind: PhaseKind;
  /** Nom du mésocycle (wizard) ; null = laisser le défaut localisé. */
  name: string | null;
  /** Thème (phase de jeu) par défaut des semaines de cette phase. */
  theme: string | null;
  /** Indices (dans `microcycles`) des semaines de cette phase, dans l'ordre. */
  microIndexes: number[];
};

export type SeasonPlan = {
  macro: { preseasonStart: string; firstMatch: string; end: string } | null;
  phases: PlannedPhase[];
  microcycles: PlannedMicrocycle[];
};

const DAY_MS = 86_400_000;
const DEFAULT_PREP_WEEKS = 4;

function civilFromInstant(instant: Date, timeZone: string): Date {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

function civilFromYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

function diffWeeks(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * DAY_MS));
}

/** ISO weekday : 1=lundi … 7=dimanche. */
function isoWeekday(d: Date): number {
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

/** Lundi (ISO) de la semaine d'une date civile. */
function startOfIsoWeek(d: Date): Date {
  return addDays(d, -(isoWeekday(d) - 1));
}

/**
 * Découpe la saison en semaines calendaires (lundi → dimanche) de la reprise au
 * dernier match, groupe en phases, place les entraînements et les MD-.
 */
export function planSeason(
  matches: AnchorMatch[],
  settings: PeriodizationSettings,
  opts: PlanOptions = {},
): SeasonPlan {
  const timeZone = opts.timeZone ?? "Europe/Zurich";
  const prepWeeks = opts.prepWeeks ?? DEFAULT_PREP_WEEKS;
  const trainingSlots =
    opts.trainingSlots
      ?.map((slot) => ({
        weekday: Math.round(slot.weekday),
        time: /^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time) ? slot.time : "19:00",
        durationMinutes: Math.max(15, Math.min(240, Math.round(slot.durationMinutes || 90))),
      }))
      .filter((slot) => slot.weekday >= 1 && slot.weekday <= 7) ?? [];
  const weekdays = new Set(
    settings.trainingWeekdays.filter((w) => w >= 1 && w <= 7),
  );

  const anchors = matches
    .filter((m) => m.isAnchor)
    .map((m) => ({ ...m, civil: civilFromInstant(m.startsAt, timeZone) }))
    .sort((a, b) => a.civil.getTime() - b.civil.getTime());

  if (anchors.length === 0) {
    return { macro: null, phases: [], microcycles: [] };
  }

  const firstMatchCivil = anchors[0].civil;
  const explicitEnd = opts.seasonEnd ? civilFromYmd(opts.seasonEnd) : null;
  const lastMatchCivil = explicitEnd ?? anchors[anchors.length - 1].civil;
  const firstMatchMonday = startOfIsoWeek(firstMatchCivil);
  const lastMatchMonday = startOfIsoWeek(lastMatchCivil);

  const structure = opts.structure;

  // Nb de semaines de prépa.
  const structPrep = structure ? Math.max(0, Math.round(structure.prepWeeks)) : null;

  // Reprise.
  let repriseMonday: Date;
  if (structPrep !== null) {
    repriseMonday = addDays(firstMatchMonday, -structPrep * 7);
  } else {
    repriseMonday =
      (opts.seasonStart && startOfIsoWeek(civilFromYmd(opts.seasonStart) ?? firstMatchMonday)) ||
      addDays(firstMatchMonday, -prepWeeks * 7);
    if (repriseMonday.getTime() > firstMatchMonday.getTime()) {
      repriseMonday = firstMatchMonday;
    }
  }

  const firstMatchIdx = diffWeeks(repriseMonday, firstMatchMonday);

  // Nombre total de semaines.
  const weeksCount = structure
    ? structPrep! + structure.mesos.reduce((s, m) => s + Math.max(0, Math.round(m.weeks)), 0)
    : diffWeeks(repriseMonday, lastMatchMonday) + 1;

  // Affectation semaine → phase (kind/name/theme), selon le mode.
  // perWeekPhase[i] = { kind, name, theme, phaseKey } ; phaseKey regroupe en blocs.
  type WeekPhase = { kind: PhaseKind; name: string | null; theme: string | null; key: string };
  const perWeekPhase: WeekPhase[] = [];
  if (structure) {
    for (let i = 0; i < structPrep!; i++) {
      perWeekPhase.push({ kind: "preparation", name: null, theme: structure.prepTheme ?? null, key: "prep" });
    }
    structure.mesos.forEach((meso, mi) => {
      const w = Math.max(0, Math.round(meso.weeks));
      for (let k = 0; k < w; k++) {
        perWeekPhase.push({
          kind: "competition",
          name: meso.name?.trim() || null,
          theme: meso.theme ?? null,
          key: `meso-${mi}`,
        });
      }
    });
  } else {
    for (let i = 0; i < weeksCount; i++) {
      const isPrep = i < firstMatchIdx;
      perWeekPhase.push({
        kind: isPrep ? "preparation" : "competition",
        name: null,
        theme: null,
        key: isPrep ? "prep" : "comp",
      });
    }
  }

  // Index de semaine → premier match d'ancrage qui y tombe.
  const matchByWeek = new Map<number, { id: string; civil: Date }>();
  for (const a of anchors) {
    const idx = diffWeeks(repriseMonday, startOfIsoWeek(a.civil));
    if (idx >= 0 && idx < weeksCount && !matchByWeek.has(idx)) {
      matchByWeek.set(idx, { id: a.id, civil: a.civil });
    }
  }

  // Construit les phases (blocs consécutifs de même key) et l'index par semaine.
  const phases: PlannedPhase[] = [];
  const phaseIndexByWeek: number[] = [];
  let lastKey: string | null = null;
  for (let i = 0; i < weeksCount; i++) {
    const wp = perWeekPhase[i] ?? { kind: "competition" as PhaseKind, name: null, theme: null, key: "comp" };
    if (wp.key !== lastKey) {
      phases.push({ kind: wp.kind, name: wp.name, theme: wp.theme, microIndexes: [] });
      lastKey = wp.key;
    }
    phaseIndexByWeek.push(phases.length - 1);
  }

  const microcycles: PlannedMicrocycle[] = [];
  for (let i = 0; i < weeksCount; i++) {
    const weekMonday = addDays(repriseMonday, i * 7);
    const match = matchByWeek.get(i) ?? null;
    const phaseIndex = phaseIndexByWeek[i];
    const phase = phases[phaseIndex].kind;

    const sessions: PlannedSession[] = [];
    if (trainingSlots.length > 0) {
      for (let d = 0; d < 7; d++) {
        const day = addDays(weekMonday, d);
        const weekday = isoWeekday(day);
        for (const slot of trainingSlots) {
          if (slot.weekday !== weekday) continue;
          sessions.push({
            date: ymd(day),
            startTime: slot.time,
            durationMinutes: slot.durationMinutes,
            mdOffset: match ? diffDays(day, match.civil) : null,
          });
        }
      }
    } else if (weekdays.size > 0) {
      for (let d = 0; d < 7; d++) {
        const day = addDays(weekMonday, d);
        if (!weekdays.has(isoWeekday(day))) continue;
        sessions.push({
          date: ymd(day),
          startTime: null,
          durationMinutes: null,
          mdOffset: match ? diffDays(day, match.civil) : null,
        });
      }
    }

    const weekNumber =
      i < firstMatchIdx ? i - firstMatchIdx : i - firstMatchIdx + 1;

    phases[phaseIndex].microIndexes.push(i);
    microcycles.push({
      index: i,
      startDate: ymd(weekMonday),
      weekNumber,
      phase,
      phaseIndex,
      targetMatchId: match?.id ?? null,
      sessions,
    });
  }

  const endSunday = addDays(addDays(repriseMonday, (weeksCount - 1) * 7), 6);

  return {
    macro: {
      preseasonStart: ymd(repriseMonday),
      firstMatch: ymd(firstMatchCivil),
      end: ymd(endSunday),
    },
    phases,
    microcycles,
  };
}
