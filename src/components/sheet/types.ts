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
  | {
      id: string;
      kind: "arrow";
      style: "run" | "pass" | "dribble";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };

export type SchemaData = { shapes: SchemaShape[] };

export const emptySchema: SchemaData = { shapes: [] };

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
  }>;
  game: { duration: string; notes: string };
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
    game: { duration: "", notes: "" },
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
    game: { ...base.game, ...(saved.game ?? {}) },
    end: { ...base.end, ...(saved.end ?? {}) },
  };
}
