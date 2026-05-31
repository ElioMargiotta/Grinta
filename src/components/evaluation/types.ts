// TIPS evaluation — data shape mirroring the Xamax/Bejune evaluation
// form: header, per-tour statistics + ASF tests, single-snapshot TIPS
// scoring, strengths / improvements, appreciation, signatures.

export const TIPS_CRITERIA = [
  // T — Technique
  { id: "T_firstTouch", group: "T" },
  { id: "T_ballDriving", group: "T" },
  { id: "T_pass", group: "T" },
  { id: "T_dribble", group: "T" },
  { id: "T_shot", group: "T" },
  // I — Intelligence - tactique
  { id: "I_scanning", group: "I" },
  { id: "I_offensive", group: "I" },
  { id: "I_defensive", group: "I" },
  // P — Personnalité - mental
  { id: "P_selfAwareness", group: "P" },
  { id: "P_emotionRegulation", group: "P" },
  { id: "P_solidarity", group: "P" },
  // S — Vitesse - condition physique
  { id: "S_speedCoordination", group: "S" },
  { id: "S_endurance", group: "S" },
] as const;

export type TipsCriterionId = (typeof TIPS_CRITERIA)[number]["id"];
type LegacyTipsCriterionId = TipsCriterionId | "I_headMovement";
export type TipsGroup = "T" | "I" | "P" | "S";

export const TIPS_GROUPS: TipsGroup[] = ["T", "I", "P", "S"];

export type TourStats = {
  matches: string;
  playTime: string;
  height: string;
  weight: string;
};

export type TourAsf = {
  speed10: string;
  speed30: string;
  proAgility: string;
  yoyo: string;
  agility: string;
  ballControl: string;
  juggling: string;
};

export type AppreciationLevel =
  | "good"
  | "envisageable"
  | "problematic"
  | "veryDifficult";

export const APPRECIATION_OPTIONS: AppreciationLevel[] = [
  "good",
  "envisageable",
  "problematic",
  "veryDifficult",
];

export type EvaluationData = {
  season: string;
  team: string;
  playerName: string;
  birthDate: string;
  position: string;
  evaluationDate: string;

  stats: { tour1: TourStats; tour2: TourStats };
  asf: { tour1: TourAsf; tour2: TourAsf };

  /** Per-criterion score (0 = unscored, 0.5-step values 1..5 allowed). */
  tips: Record<TipsCriterionId, number>;
  /** One free-text comment per TIPS group (T / I / P / S). */
  tipsComments: Record<TipsGroup, string>;

  /** Free-form bullets — 3 lines per list, all printed on the PDF. */
  strengths: [string, string, string];
  improvements: [string, string, string];

  appreciation: AppreciationLevel[];

  signatures: {
    technicalLead: string;
    coaches: string;
    parents: string;
    date: string;
  };
};

function emptyStats(): TourStats {
  return { matches: "", playTime: "", height: "", weight: "" };
}

function emptyAsf(): TourAsf {
  return {
    speed10: "",
    speed30: "",
    proAgility: "",
    yoyo: "",
    agility: "",
    ballControl: "",
    juggling: "",
  };
}

function emptyTips(): Record<TipsCriterionId, number> {
  return Object.fromEntries(
    TIPS_CRITERIA.map((c) => [c.id, 0]),
  ) as Record<TipsCriterionId, number>;
}

function emptyTipsComments(): Record<TipsGroup, string> {
  return { T: "", I: "", P: "", S: "" };
}

export function makeEmptyEvaluation(): EvaluationData {
  return {
    season: "",
    team: "",
    playerName: "",
    birthDate: "",
    position: "",
    evaluationDate: "",
    stats: { tour1: emptyStats(), tour2: emptyStats() },
    asf: { tour1: emptyAsf(), tour2: emptyAsf() },
    tips: emptyTips(),
    tipsComments: emptyTipsComments(),
    strengths: ["", "", ""],
    improvements: ["", "", ""],
    appreciation: [],
    signatures: { technicalLead: "", coaches: "", parents: "", date: "" },
  };
}

// Reads back a saved JSON snapshot. Accepts the legacy shape where each
// criterion was `{ score, comment }` (per-row comments) — we keep the
// score and drop the row-level comment (group-level comments replaced
// them); pre-launch data only.
export function mergeEvaluation(
  saved: Partial<EvaluationData> | null | undefined,
): EvaluationData {
  const base = makeEmptyEvaluation();
  if (!saved) return base;
  const savedTips = (saved.tips ?? {}) as Partial<
    Record<LegacyTipsCriterionId, number | { score?: number; comment?: string }>
  >;
  const mergedTips = { ...base.tips };
  for (const c of TIPS_CRITERIA) {
    const s = savedTips[c.id];
    if (typeof s === "number") {
      mergedTips[c.id] = s;
    } else if (s && typeof s === "object" && typeof s.score === "number") {
      mergedTips[c.id] = s.score;
    }
  }
  if (mergedTips.I_scanning === 0) {
    const legacyHeadMovement = savedTips.I_headMovement;
    if (typeof legacyHeadMovement === "number") {
      mergedTips.I_scanning = legacyHeadMovement;
    } else if (
      legacyHeadMovement &&
      typeof legacyHeadMovement === "object" &&
      typeof legacyHeadMovement.score === "number"
    ) {
      mergedTips.I_scanning = legacyHeadMovement.score;
    }
  }
  const savedComments = (saved.tipsComments ?? {}) as Partial<
    Record<TipsGroup, string>
  >;
  const mergedComments: Record<TipsGroup, string> = {
    T: savedComments.T ?? "",
    I: savedComments.I ?? "",
    P: savedComments.P ?? "",
    S: savedComments.S ?? "",
  };
  const savedAppreciation = saved.appreciation as unknown;
  const mergedAppreciation = Array.isArray(savedAppreciation)
    ? savedAppreciation.filter((a): a is AppreciationLevel =>
        APPRECIATION_OPTIONS.includes(a as AppreciationLevel),
      )
    : APPRECIATION_OPTIONS.includes(savedAppreciation as AppreciationLevel)
      ? [savedAppreciation as AppreciationLevel]
      : [];
  return {
    ...base,
    ...saved,
    stats: {
      tour1: { ...base.stats.tour1, ...(saved.stats?.tour1 ?? {}) },
      tour2: { ...base.stats.tour2, ...(saved.stats?.tour2 ?? {}) },
    },
    asf: {
      tour1: { ...base.asf.tour1, ...(saved.asf?.tour1 ?? {}) },
      tour2: { ...base.asf.tour2, ...(saved.asf?.tour2 ?? {}) },
    },
    tips: mergedTips,
    tipsComments: mergedComments,
    strengths: [
      saved.strengths?.[0] ?? "",
      saved.strengths?.[1] ?? "",
      saved.strengths?.[2] ?? "",
    ],
    improvements: [
      saved.improvements?.[0] ?? "",
      saved.improvements?.[1] ?? "",
      saved.improvements?.[2] ?? "",
    ],
    appreciation: mergedAppreciation,
    signatures: { ...base.signatures, ...(saved.signatures ?? {}) },
  };
}

/** Group-wise average over scored criteria (score > 0). */
export function groupAverage(
  tips: Record<TipsCriterionId, number>,
  group: TipsGroup,
): number | null {
  const scores = TIPS_CRITERIA.filter((c) => c.group === group)
    .map((c) => tips[c.id])
    .filter((s) => s > 0);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** Mean of all scored criteria — the printed "Note moyenne". */
export function overallAverage(
  tips: Record<TipsCriterionId, number>,
): number | null {
  const scores = TIPS_CRITERIA.map((c) => tips[c.id]).filter((s) => s > 0);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
