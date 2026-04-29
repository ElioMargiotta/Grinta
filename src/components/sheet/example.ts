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
      },
    ],
    game: {
      duration: "15 min",
      notes: "11v11 free play on full pitch. Last 15 minutes. Normal rules.",
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
