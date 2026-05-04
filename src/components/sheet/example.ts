import type { PreparationData } from "./types";

export function exampleSheet(): PreparationData {
  return {
    date: new Date().toISOString().slice(0, 10),
    team: "U15 Élite",
    coach: "J. Doe",
    phases: {
      possession: true,
      losing: false,
      noPossession: true,
      recovering: false,
    },
    characteristicForm:
      "Build-up from the goalkeeper under high opposition press.",
    focus: "TA — pressing triggers and short build-up.",
    objectives:
      "Recognize the press trigger. Play forward in 1–2 touches. Stay compact when losing the ball.",
    developmentQuestions:
      "When does the #6 drop between the center backs? What's our first option after the GK throws?",
    initial: {
      duration: "25 min",
      phase1: {
        description:
          "Players in pairs jog around half-pitch, ball rolling between them. 4 minutes.",
        coaching:
          "Cones at corners. Cues: high-quality first touch, head up before passing, 5–6 m apart.",
        schema: {
          shapes: [
            { id: "ex-h1", kind: "player", team: "home", label: "1", x: 70, y: 55 },
            { id: "ex-h2", kind: "player", team: "home", label: "2", x: 50, y: 80 },
            { id: "ex-a1", kind: "player", team: "away", label: "1", x: 100, y: 45 },
            { id: "ex-gk", kind: "player", team: "gk", label: "G", x: 18, y: 52 },
            { id: "ex-ball", kind: "ball", x: 70, y: 55 },
            { id: "ex-cone", kind: "cone", x: 120, y: 90 },
            {
              id: "ex-pass",
              kind: "arrow",
              style: "pass",
              x1: 70,
              y1: 55,
              x2: 50,
              y2: 80,
            },
          ],
        },
        prevention: {
          ankle: {
            description: "Single-leg balance, 25s each side.",
            coaching: "Soft knee, gaze forward, arms relaxed.",
          },
          knee: {
            description: "Side-to-side mini squats, 25s.",
            coaching: "Knee tracks over the foot, no caving in.",
          },
          hip: {
            description: "Bridge with single-leg lift, 25s each.",
            coaching: "Squeeze glutes, neutral spine.",
          },
          hamstring: {
            description: "Nordic eccentrics, 25s — partner-assisted.",
            coaching: "Slow descent, control the last 10 cm.",
          },
        },
      },
      phase2: {
        description: "Rondo 4v2 in 8m square, two-touch limit. 3 × 4 minutes.",
        coaching: "Defenders rotate after winning the ball. Cue: scan before receiving.",
        schema: {
          shapes: [
            { id: "ex2-h1", kind: "player", team: "home", label: "1", x: 60, y: 40 },
            { id: "ex2-h2", kind: "player", team: "home", label: "2", x: 90, y: 40 },
            { id: "ex2-h3", kind: "player", team: "home", label: "3", x: 60, y: 70 },
            { id: "ex2-h4", kind: "player", team: "home", label: "4", x: 90, y: 70 },
            { id: "ex2-a1", kind: "player", team: "away", label: "1", x: 75, y: 50 },
            { id: "ex2-a2", kind: "player", team: "away", label: "2", x: 75, y: 60 },
            { id: "ex2-ball", kind: "ball", x: 60, y: 40 },
            {
              id: "ex2-pass",
              kind: "arrow",
              style: "pass",
              x1: 60,
              y1: 40,
              x2: 90,
              y2: 40,
            },
          ],
        },
      },
      phase3: {
        description: "4 × 10 m sprint with change of direction at the cone, 30s rest. 3 sets.",
        coaching: "Full intensity. Walk back recovery. Stay low through the change of direction.",
      },
    },
    main: [
      {
        type: "exercise",
        duration: "20 min",
        description:
          "Build-up exercise: GK + back four + #6 vs 3 strikers high-pressing. Score by playing through the half-line gate.",
        coaching:
          "Trigger = back-pass to GK. Cue body shape on first touch. Reward forward passes through the gate.",
        organisation:
          "Half-pitch. 3 yellow gates on the half-line. 3 mannequins as outlet markers behind.",
        variations:
          "+ add a #10 between the lines as a free option. − reduce gate count to 2; longer rest.",
        schema: {
          shapes: [
            { id: "m1-gk", kind: "player", team: "gk", label: "G", x: 71, y: 188 },
            { id: "m1-h1", kind: "player", team: "home", label: "1", x: 35, y: 160 },
            { id: "m1-h2", kind: "player", team: "home", label: "2", x: 107, y: 160 },
            { id: "m1-h3", kind: "player", team: "home", label: "3", x: 50, y: 130 },
            { id: "m1-h4", kind: "player", team: "home", label: "4", x: 92, y: 130 },
            { id: "m1-h5", kind: "player", team: "home", label: "5", x: 71, y: 100 },
            { id: "m1-a1", kind: "player", team: "away", label: "1", x: 50, y: 70 },
            { id: "m1-a2", kind: "player", team: "away", label: "2", x: 71, y: 60 },
            { id: "m1-a3", kind: "player", team: "away", label: "3", x: 92, y: 70 },
            { id: "m1-ball", kind: "ball", x: 71, y: 188 },
            {
              id: "m1-pass",
              kind: "arrow",
              style: "pass",
              x1: 71,
              y1: 188,
              x2: 71,
              y2: 100,
            },
          ],
        },
      },
      {
        type: "playForm",
        duration: "20 min",
        description:
          "8v8 + GKs on 50×40 m, full goals, 4-minute sets with 1-minute rest.",
        coaching:
          "Encourage forward passes after winning the ball. First switch unlocks a second goal value.",
        organisation:
          "50×40 m, 2 GKs at full goals, halfway line marked.",
        variations:
          "+ score double on goals after a switch. − one-touch limit in defensive third.",
        schema: {
          shapes: [
            { id: "m2-gkh", kind: "player", team: "gk", label: "G", x: 71, y: 188 },
            { id: "m2-gka", kind: "player", team: "gk", label: "G", x: 71, y: 12 },
            { id: "m2-h1", kind: "player", team: "home", label: "1", x: 35, y: 150 },
            { id: "m2-h2", kind: "player", team: "home", label: "2", x: 107, y: 150 },
            { id: "m2-h3", kind: "player", team: "home", label: "3", x: 50, y: 115 },
            { id: "m2-h4", kind: "player", team: "home", label: "4", x: 92, y: 115 },
            { id: "m2-a1", kind: "player", team: "away", label: "1", x: 35, y: 50 },
            { id: "m2-a2", kind: "player", team: "away", label: "2", x: 107, y: 50 },
            { id: "m2-a3", kind: "player", team: "away", label: "3", x: 50, y: 85 },
            { id: "m2-a4", kind: "player", team: "away", label: "4", x: 92, y: 85 },
            { id: "m2-ball", kind: "ball", x: 71, y: 100 },
            {
              id: "m2-run",
              kind: "arrow",
              style: "run",
              x1: 50,
              y1: 115,
              x2: 71,
              y2: 80,
            },
          ],
        },
      },
    ],
    game: {
      duration: "15 min",
      notes: "11v11 free play on full pitch. Last 15 minutes. Normal rules.",
      schema: {
        shapes: [
          { id: "g-gkh", kind: "player", team: "gk", label: "G", x: 8, y: 45 },
          { id: "g-gka", kind: "player", team: "gk", label: "G", x: 118, y: 45 },
          { id: "g-h1", kind: "player", team: "home", label: "1", x: 28, y: 25 },
          { id: "g-h2", kind: "player", team: "home", label: "2", x: 28, y: 65 },
          { id: "g-h3", kind: "player", team: "home", label: "3", x: 50, y: 45 },
          { id: "g-a1", kind: "player", team: "away", label: "1", x: 95, y: 25 },
          { id: "g-a2", kind: "player", team: "away", label: "2", x: 95, y: 65 },
          { id: "g-a3", kind: "player", team: "away", label: "3", x: 75, y: 45 },
          { id: "g-ball", kind: "ball", x: 63, y: 45 },
        ],
      },
    },
    end: {
      duration: "5 min",
      notes:
        "Walk to center circle. 60s breathing. Quick verbal debrief — what did we see on the press triggers?",
    },
    reflection:
      "What worked, what didn't, who needs more individual work next week.",
  };
}
