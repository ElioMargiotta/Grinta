// Présets de formation pour la compo visuelle.
//
// Coordonnées normalisées : x ∈ [0,100] (gauche→droite), y ∈ [0,100] où y=0 est
// le but ADVERSE (haut du terrain) et y=100 notre but (bas). Notre équipe attaque
// vers le haut. Chaque préset compte exactement 11 positions (gardien inclus).

export type FormationSlot = { role: string; x: number; y: number };

export const FORMATIONS: Record<string, FormationSlot[]> = {
  "4-3-3": [
    { role: "GK", x: 50, y: 92 },
    { role: "RB", x: 80, y: 72 },
    { role: "CB", x: 62, y: 76 },
    { role: "CB", x: 38, y: 76 },
    { role: "LB", x: 20, y: 72 },
    { role: "CM", x: 65, y: 54 },
    { role: "CM", x: 50, y: 58 },
    { role: "CM", x: 35, y: 54 },
    { role: "RW", x: 78, y: 28 },
    { role: "ST", x: 50, y: 20 },
    { role: "LW", x: 22, y: 28 },
  ],
  "4-4-2": [
    { role: "GK", x: 50, y: 92 },
    { role: "RB", x: 82, y: 72 },
    { role: "CB", x: 62, y: 75 },
    { role: "CB", x: 38, y: 75 },
    { role: "LB", x: 18, y: 72 },
    { role: "RM", x: 82, y: 48 },
    { role: "CM", x: 60, y: 52 },
    { role: "CM", x: 40, y: 52 },
    { role: "LM", x: 18, y: 48 },
    { role: "ST", x: 60, y: 24 },
    { role: "ST", x: 40, y: 24 },
  ],
  "4-2-3-1": [
    { role: "GK", x: 50, y: 92 },
    { role: "RB", x: 82, y: 72 },
    { role: "CB", x: 62, y: 75 },
    { role: "CB", x: 38, y: 75 },
    { role: "LB", x: 18, y: 72 },
    { role: "DM", x: 62, y: 58 },
    { role: "DM", x: 38, y: 58 },
    { role: "RAM", x: 78, y: 40 },
    { role: "CAM", x: 50, y: 38 },
    { role: "LAM", x: 22, y: 40 },
    { role: "ST", x: 50, y: 20 },
  ],
  "3-5-2": [
    { role: "GK", x: 50, y: 92 },
    { role: "CB", x: 68, y: 76 },
    { role: "CB", x: 50, y: 78 },
    { role: "CB", x: 32, y: 76 },
    { role: "RWB", x: 86, y: 55 },
    { role: "CM", x: 62, y: 54 },
    { role: "CM", x: 50, y: 58 },
    { role: "CM", x: 38, y: 54 },
    { role: "LWB", x: 14, y: 55 },
    { role: "ST", x: 60, y: 24 },
    { role: "ST", x: 40, y: 24 },
  ],
  "3-4-3": [
    { role: "GK", x: 50, y: 92 },
    { role: "CB", x: 68, y: 76 },
    { role: "CB", x: 50, y: 78 },
    { role: "CB", x: 32, y: 76 },
    { role: "RM", x: 82, y: 52 },
    { role: "CM", x: 60, y: 54 },
    { role: "CM", x: 40, y: 54 },
    { role: "LM", x: 18, y: 52 },
    { role: "RW", x: 78, y: 26 },
    { role: "ST", x: 50, y: 22 },
    { role: "LW", x: 22, y: 26 },
  ],
  "5-3-2": [
    { role: "GK", x: 50, y: 92 },
    { role: "RWB", x: 86, y: 68 },
    { role: "CB", x: 66, y: 76 },
    { role: "CB", x: 50, y: 78 },
    { role: "CB", x: 34, y: 76 },
    { role: "LWB", x: 14, y: 68 },
    { role: "CM", x: 62, y: 52 },
    { role: "CM", x: 50, y: 56 },
    { role: "CM", x: 38, y: 52 },
    { role: "ST", x: 60, y: 24 },
    { role: "ST", x: 40, y: 24 },
  ],
  "4-1-4-1": [
    { role: "GK", x: 50, y: 92 },
    { role: "RB", x: 82, y: 72 },
    { role: "CB", x: 62, y: 75 },
    { role: "CB", x: 38, y: 75 },
    { role: "LB", x: 18, y: 72 },
    { role: "DM", x: 50, y: 60 },
    { role: "RM", x: 82, y: 46 },
    { role: "CM", x: 60, y: 48 },
    { role: "CM", x: 40, y: 48 },
    { role: "LM", x: 18, y: 46 },
    { role: "ST", x: 50, y: 22 },
  ],
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);
export const DEFAULT_FORMATION = "4-3-3";

/** Convertit une coordonnée terrain (0..100) en % du conteneur, en tenant
 *  compte des marges du viewBox de FullPitch (-2 -2 72 109, terrain 68×105). */
export function pitchLeftPct(x: number): number {
  return (2 / 72) * 100 + (x / 100) * ((68 / 72) * 100);
}
export function pitchTopPct(y: number): number {
  return (2 / 109) * 100 + (y / 100) * ((105 / 109) * 100);
}
