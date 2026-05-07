export type PreventionRow = { description: string; coaching: string };

export type SchemaShape =
  | {
      id: string;
      kind: "player";
      team: "home" | "away" | "gk";
      label?: string;
      x: number;
      y: number;
    }
  | { id: string; kind: "ball"; x: number; y: number }
  | { id: string; kind: "cone"; x: number; y: number }
  | { id: string; kind: "goal"; orientation: "h" | "v"; x: number; y: number }
  | {
      id: string;
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
  | {
      id: string;
      kind: "arrow";
      style: "run" | "pass" | "dribble" | "long-ball";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };

export type SchemaData = { shapes: SchemaShape[] };

export const emptySchema: SchemaData = { shapes: [] };

export type FocusFamily = "TE" | "TA" | "PE" | "AT";
export const FOCUS_FAMILIES: FocusFamily[] = ["TE", "TA", "PE", "AT"];

export type PreparationData = {
  date: string;
  team: string;
  coach: string;
  phases: {
    possession: boolean;
    losing: boolean;
    noPossession: boolean;
    recovering: boolean;
  };
  /** Coaching focus families targeted by this session — drives library
   * filtering and which family's coaching points get pre-filled in the
   * imported main blocks. */
  focusFamilies: FocusFamily[];
  characteristicForm: string;
  focus: string;
  objectives: string;
  developmentQuestions: string;
  initial: {
    duration: string;
    phase1: {
      description: string;
      coaching: string;
      schema: SchemaData;
      prevention: {
        ankle: PreventionRow;
        knee: PreventionRow;
        hip: PreventionRow;
        hamstring: PreventionRow;
      };
    };
    phase2: { description: string; coaching: string; schema: SchemaData };
    phase3: { description: string; coaching: string };
  };
  main: Array<{
    type: "playForm" | "exercise";
    duration: string;
    description: string;
    coaching: string;
    organisation: string;
    variations: string;
    schema: SchemaData;
    /** When the user imports an exercise from the library, we keep its id
     * (so we can re-link to the source) and its main_image (rendered in
     * the schema slot, including in the PDF export). */
    exerciseId?: string;
    imageUrl?: string;
  }>;
  game: { duration: string; notes: string; schema: SchemaData };
  end: { duration: string; notes: string };
  reflection: string;
};

export const emptyPrevention: PreventionRow = { description: "", coaching: "" };

export function makeEmptyPreparation(): PreparationData {
  return {
    date: "",
    team: "",
    coach: "",
    phases: {
      possession: false,
      losing: false,
      noPossession: false,
      recovering: false,
    },
    focusFamilies: [],
    characteristicForm: "",
    focus: "",
    objectives: "",
    developmentQuestions: "",
    initial: {
      duration: "",
      phase1: {
        description: "",
        coaching: "",
        schema: { shapes: [] },
        prevention: {
          ankle: { ...emptyPrevention },
          knee: { ...emptyPrevention },
          hip: { ...emptyPrevention },
          hamstring: { ...emptyPrevention },
        },
      },
      phase2: { description: "", coaching: "", schema: { shapes: [] } },
      phase3: { description: "", coaching: "" },
    },
    main: [
      {
        type: "exercise",
        duration: "",
        description: "",
        coaching: "",
        organisation: "",
        variations: "",
        schema: { shapes: [] },
      },
      {
        type: "exercise",
        duration: "",
        description: "",
        coaching: "",
        organisation: "",
        variations: "",
        schema: { shapes: [] },
      },
    ],
    game: { duration: "", notes: "", schema: { shapes: [] } },
    end: { duration: "", notes: "" },
    reflection: "",
  };
}

export function mergePreparation(
  saved: Partial<PreparationData> | null | undefined,
): PreparationData {
  const base = makeEmptyPreparation();
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    phases: { ...base.phases, ...(saved.phases ?? {}) },
    focusFamilies: Array.isArray(saved.focusFamilies)
      ? (saved.focusFamilies.filter((f) =>
          FOCUS_FAMILIES.includes(f as FocusFamily),
        ) as FocusFamily[])
      : base.focusFamilies,
    initial: {
      ...base.initial,
      ...(saved.initial ?? {}),
      phase1: {
        ...base.initial.phase1,
        ...(saved.initial?.phase1 ?? {}),
        schema:
          saved.initial?.phase1?.schema &&
          Array.isArray(saved.initial.phase1.schema.shapes)
            ? saved.initial.phase1.schema
            : base.initial.phase1.schema,
        prevention: {
          ...base.initial.phase1.prevention,
          ...(saved.initial?.phase1?.prevention ?? {}),
        },
      },
      phase2: {
        ...base.initial.phase2,
        ...(saved.initial?.phase2 ?? {}),
        schema:
          saved.initial?.phase2?.schema &&
          Array.isArray(saved.initial.phase2.schema.shapes)
            ? saved.initial.phase2.schema
            : base.initial.phase2.schema,
      },
      phase3: { ...base.initial.phase3, ...(saved.initial?.phase3 ?? {}) },
    },
    main:
      saved.main && saved.main.length === 2
        ? (saved.main.map((m, i) => ({
            ...base.main[i],
            ...m,
            schema:
              m.schema && Array.isArray(m.schema.shapes)
                ? m.schema
                : base.main[i].schema,
          })) as PreparationData["main"])
        : base.main,
    game: {
      ...base.game,
      ...(saved.game ?? {}),
      schema:
        saved.game?.schema && Array.isArray(saved.game.schema.shapes)
          ? saved.game.schema
          : base.game.schema,
    },
    end: { ...base.end, ...(saved.end ?? {}) },
  };
}
