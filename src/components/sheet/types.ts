export type PreventionRow = { description: string; coaching: string };

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
      prevention: {
        ankle: PreventionRow;
        knee: PreventionRow;
        hip: PreventionRow;
        hamstring: PreventionRow;
      };
    };
    phase2: { description: string; coaching: string };
    phase3: { description: string; coaching: string };
  };
  main: Array<{
    type: "playForm" | "exercise";
    duration: string;
    description: string;
    coaching: string;
    organisation: string;
    variations: string;
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
        prevention: {
          ankle: { ...emptyPrevention },
          knee: { ...emptyPrevention },
          hip: { ...emptyPrevention },
          hamstring: { ...emptyPrevention },
        },
      },
      phase2: { description: "", coaching: "" },
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
      },
      {
        type: "exercise",
        duration: "",
        description: "",
        coaching: "",
        organisation: "",
        variations: "",
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
        prevention: {
          ...base.initial.phase1.prevention,
          ...(saved.initial?.phase1?.prevention ?? {}),
        },
      },
      phase2: { ...base.initial.phase2, ...(saved.initial?.phase2 ?? {}) },
      phase3: { ...base.initial.phase3, ...(saved.initial?.phase3 ?? {}) },
    },
    main:
      saved.main && saved.main.length === 2
        ? (saved.main as PreparationData["main"])
        : base.main,
    game: { ...base.game, ...(saved.game ?? {}) },
    end: { ...base.end, ...(saved.end ?? {}) },
  };
}
