// Modèle de prix des licences (sur devis) — LOGIQUE PURE, sans I/O.
//
// Tarif PLAT : seules les équipes de FORMATION (catégories juniors D/C/B/A +
// actifs) sont facturées, à 40 CHF/équipe/mois. Le « football des enfants »
// (juniors G/F/E, ASF) est INCLUS gratuitement et n'entre pas dans le compte.
// Annuel = −5 %. Pas de dégression : on ne facture que des équipes à forte
// valeur, donc un tarif unique est plus juste et plus lisible.
//
// Le devis affiché est indicatif : l'admin saisit le nombre d'équipes
// facturables et reste libre du montant réel hors de l'app.

export const PRICING_CURRENCY = "CHF";
export const ANNUAL_DISCOUNT = 0.05;
export const TEAM_RATE = 40; // CHF / équipe facturable / mois

// Catégories ASF (liste de référence figée). « Football des enfants » = inclus.
export const ENFANTS_CATEGORIES = ["G", "F", "E"] as const;
export const BILLABLE_CATEGORIES = ["D", "C", "B", "A", "actifs"] as const;

export type EnfantsCategory = (typeof ENFANTS_CATEGORIES)[number];
export type BillableCategory = (typeof BILLABLE_CATEGORIES)[number];
export type TeamCategory = EnfantsCategory | BillableCategory;

/** True si la catégorie est facturée (formation : D/C/B/A + actifs). */
export function isBillableCategory(category: string | null | undefined): boolean {
  return category != null && (BILLABLE_CATEGORIES as readonly string[]).includes(category);
}

export type LicensePrice = {
  billableTeams: number;
  perTeam: number; // CHF/équipe/mois (tarif plat)
  monthly: number; // CHF/mois
  annual: number; // CHF/an, remise appliquée
  annualUndiscounted: number; // CHF/an avant remise (= mensuel × 12)
  currency: string;
};

/**
 * Devis pour un nombre d'équipes facturables. Renvoie null quand le nombre est
 * absent ou nul : rien à facturer (p. ex. un club uniquement « école de foot »).
 */
export function computeLicensePrice(
  billableTeams: number | null | undefined,
): LicensePrice | null {
  if (billableTeams == null || !Number.isFinite(billableTeams) || billableTeams <= 0) return null;
  const n = Math.floor(billableTeams);
  const monthly = n * TEAM_RATE;
  const annualUndiscounted = monthly * 12;
  const annual = Math.round(annualUndiscounted * (1 - ANNUAL_DISCOUNT));
  return { billableTeams: n, perTeam: TEAM_RATE, monthly, annual, annualUndiscounted, currency: PRICING_CURRENCY };
}
