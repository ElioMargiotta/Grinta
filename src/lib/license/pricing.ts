// Modèle de prix des licences (sur devis) — LOGIQUE PURE, sans I/O.
//
// Le prix est piloté par le NOMBRE D'ÉQUIPES : la base par équipe couvre déjà un
// effectif normal et la périodisation/suivi/kit de match. Les quotas joueurs et
// staff restent des limites de capacité, SANS impact sur le prix.
//
// Tarif dégressif 40 → 30 CHF/équipe/mois (les gros clubs descendent vers le
// plancher). Annuel = −5 % vs mensuel. Le devis affiché est indicatif : l'admin
// reste libre d'ajuster le montant réel hors de l'app.

export const PRICING_CURRENCY = "CHF";
export const ANNUAL_DISCOUNT = 0.05;

type Tier = { upTo: number | null; rate: number };
// rate = CHF/équipe/mois ; upTo = borne haute incluse (null = au-delà).
export const TEAM_PRICE_TIERS: Tier[] = [
  { upTo: 3, rate: 40 },
  { upTo: 8, rate: 36 },
  { upTo: 15, rate: 33 },
  { upTo: null, rate: 30 },
];

/** Tarif CHF/équipe/mois appliqué pour un nombre d'équipes donné. */
export function teamRate(teams: number): number {
  for (const tier of TEAM_PRICE_TIERS) {
    if (tier.upTo === null || teams <= tier.upTo) return tier.rate;
  }
  return TEAM_PRICE_TIERS[TEAM_PRICE_TIERS.length - 1].rate;
}

export type LicensePrice = {
  teams: number;
  perTeam: number; // CHF/équipe/mois appliqué
  monthly: number; // CHF/mois
  annual: number; // CHF/an, remise appliquée
  annualUndiscounted: number; // CHF/an avant remise (= mensuel × 12)
  currency: string;
};

/**
 * Devis pour un nombre d'équipes. Renvoie null quand le nombre est absent, nul
 * ou illimité (quota vide) : dans ce cas le prix n'est pas calculable
 * automatiquement et reste « sur devis ».
 */
export function computeLicensePrice(
  teams: number | null | undefined,
): LicensePrice | null {
  if (teams == null || !Number.isFinite(teams) || teams <= 0) return null;
  const n = Math.floor(teams);
  const perTeam = teamRate(n);
  const monthly = n * perTeam;
  const annualUndiscounted = monthly * 12;
  const annual = Math.round(annualUndiscounted * (1 - ANNUAL_DISCOUNT));
  return { teams: n, perTeam, monthly, annual, annualUndiscounted, currency: PRICING_CURRENCY };
}
