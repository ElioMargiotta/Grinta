/**
 * Helpers saison — LOGIQUE PURE partagée serveur (page, actions) et client (UI).
 *
 * Une saison sportive est désignée par son millésime `YYYY/YY` (ex. `2025/26`)
 * et couvre une fenêtre de dates juillet → juin de l'année suivante. Toutes les
 * vues du planner (Saison ET Hebdo) sont isolées par cette fenêtre : on ne voit
 * jamais deux millésimes mélangés.
 */

/** Année de début d'un millésime `YYYY/YY` (ex. "2025/26" → 2025). */
export function seasonStartYear(label: string): number {
  const m = /^(\d{4})/.exec(label);
  return m ? Number(m[1]) : new Date().getFullYear();
}

/** Construit le libellé `YYYY/YY` à partir de l'année de début. */
export function seasonLabelFromYear(year: number): string {
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

/** Millésime courant selon la date (la saison bascule le 1er juillet). */
export function currentSeasonLabel(now: Date = new Date()): string {
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return seasonLabelFromYear(year);
}

/** Fenêtre de dates `YYYY-MM-DD` (juil. → juin) d'un millésime. */
export function seasonWindow(label: string): { start: string; end: string } {
  const year = seasonStartYear(label);
  return { start: `${year}-07-01`, end: `${year + 1}-06-30` };
}

/** Normalise une valeur reçue (searchParam) en millésime valide, sinon courant. */
export function normalizeSeasonLabel(value: string | null | undefined): string {
  return value && /^\d{4}\/\d{2}$/.test(value) ? value : currentSeasonLabel();
}
