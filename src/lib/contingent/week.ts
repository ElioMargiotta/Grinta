/**
 * Helpers de suivi hebdomadaire pour le module physique.
 *
 * Le suivi physique est saisi par semaine. La clé de stockage est
 * `week_start` = le **lundi** de la semaine, au format ISO `YYYY-MM-DD`
 * (sans heure, pour rester indépendant du fuseau et trier proprement).
 */

/** Lundi de la semaine d'une date donnée, en `YYYY-MM-DD` (UTC). */
export function weekStartMonday(input: Date | string): string {
  const d =
    typeof input === "string" ? new Date(`${input}T00:00:00Z`) : new Date(input);
  // getUTCDay : 0 = dimanche … 6 = samedi. On ramène au lundi.
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // nb de jours depuis lundi
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff),
  );
  return monday.toISOString().slice(0, 10);
}

/** Lundi de la semaine courante, en `YYYY-MM-DD`. */
export function currentWeekStart(): string {
  return weekStartMonday(new Date());
}

/** `week_start` décalé de `delta` semaines (négatif = passé). */
export function shiftWeek(weekStart: string, delta: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Liste des `count` dernières semaines (lundis) jusqu'à `until` inclus,
 * du plus ancien au plus récent.
 */
export function recentWeeks(count: number, until?: string): string[] {
  const end = weekStartMonday(until ?? new Date());
  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i--) weeks.push(shiftWeek(end, -i));
  return weeks;
}

/** Libellé court d'une semaine, ex. "lun. 16 juin" → "Sem. du 16.06". */
export function formatWeek(weekStart: string): string {
  const [, m, d] = weekStart.split("-");
  return `${d}.${m}`;
}

/**
 * Le suivi physique est désormais piloté par les **dates de test** (cadence
 * libre), plutôt que par des semaines fixes. Les helpers ci-dessous opèrent
 * sur des dates ISO `YYYY-MM-DD`.
 */

/** Date du jour en `YYYY-MM-DD` (calendrier local). */
export function todayISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Libellé court d'une date ISO `YYYY-MM-DD`, ex. "16.06". */
export function formatDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}
