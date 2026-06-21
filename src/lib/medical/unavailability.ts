/**
 * Disponibilité joueur — source de vérité unique partagée entre la fiche
 * joueur (onglet Médical), la grille éval et le roster de présence.
 *
 * Une indisponibilité couvre une PÉRIODE : une seule saisie s'applique à
 * toutes les séances/évals de l'intervalle, sans ressaisie par séance.
 */

export type UnavailabilityKind = "injury" | "illness" | "suspension" | "other";

export const UNAVAILABILITY_KINDS: UnavailabilityKind[] = [
  "injury",
  "illness",
  "suspension",
  "other",
];

export type Unavailability = {
  id: string;
  playerId: string;
  kind: UnavailabilityKind;
  reason: string | null;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string | null; // null = encore en cours
};

/** Vrai si la période couvre la date (bornes incluses, end_date NULL = ouverte). */
export function coversDate(
  u: { startDate: string; endDate: string | null },
  date: string,
): boolean {
  return u.startDate <= date && (u.endDate === null || u.endDate >= date);
}

// Priorité d'affichage si plusieurs périodes se chevauchent à une date donnée.
const KIND_PRIORITY: Record<UnavailabilityKind, number> = {
  injury: 0,
  illness: 1,
  suspension: 2,
  other: 3,
};

/** Période active la plus prioritaire couvrant `date`, ou null si disponible. */
export function activeUnavailability(
  list: Unavailability[],
  date: string,
): Unavailability | null {
  const covering = list.filter((u) => coversDate(u, date));
  if (covering.length === 0) return null;
  covering.sort(
    (a, b) =>
      KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] ||
      b.startDate.localeCompare(a.startDate),
  );
  return covering[0];
}

/**
 * Disponibilité effective d'un joueur pour une séance, en combinant la période
 * médicale (prioritaire) et la présence ponctuelle saisie pour la séance.
 */
export type PlayerAvailability =
  | { status: "available" }
  | { status: "unavailable"; kind: UnavailabilityKind; reason: string | null }
  | { status: "absent"; reason: string | null };

export function resolveAvailability({
  unavailabilities,
  date,
  attendance,
}: {
  unavailabilities: Unavailability[];
  date: string;
  attendance?: { status: "present" | "absent" | null; reason: string | null } | null;
}): PlayerAvailability {
  const active = activeUnavailability(unavailabilities, date);
  if (active) {
    return { status: "unavailable", kind: active.kind, reason: active.reason };
  }
  if (attendance?.status === "absent") {
    return { status: "absent", reason: attendance.reason };
  }
  return { status: "available" };
}
