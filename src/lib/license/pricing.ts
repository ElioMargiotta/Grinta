// Modèle de prix des licences (sur devis) — LOGIQUE PURE, sans I/O.
//
// Le prix est piloté par le NOMBRE D'ÉQUIPES D'AUSBILDUNG (Juniors D → Actifs) :
// la base par équipe couvre déjà un effectif normal et la périodisation/suivi/kit
// de match. Les quotas joueurs et staff restent des limites de capacité, SANS
// impact sur le prix.

// Tarif UNIQUE 25 CHF/équipe/mois (flat). Le football des enfants (G/F/E) est
// inclus gratuitement et n'entre pas dans le décompte des équipes facturées : la
// gratuité G/F/E joue déjà le rôle de remise volume. Les très grosses académies
// restent négociées au cas par cas — l'admin ajuste le montant réel hors barème.
// Annuel = −5 % vs mensuel. Le devis affiché est indicatif.

export const PRICING_CURRENCY = "CHF";
export const ANNUAL_DISCOUNT = 0.05;

/** Tarif unique CHF/équipe d'ausbildung/mois (G/F/E exclus du décompte). */
export const TEAM_RATE = 25;

export type LicensePrice = {
  teams: number; // équipes facturées (ausbildung, G/F/E exclus)
  perTeam: number; // CHF/équipe/mois appliqué
  monthly: number; // CHF/mois
  annual: number; // CHF/an, remise appliquée
  annualUndiscounted: number; // CHF/an avant remise (= mensuel × 12)
  currency: string;
};

/**
 * Devis pour un nombre d'équipes facturées (Juniors D → Actifs ; G/F/E gratuits,
 * à exclure en amont). Renvoie null quand le nombre est absent, nul ou illimité
 * (quota vide) : dans ce cas le prix n'est pas calculable automatiquement et
 * reste « sur devis ».
 */
export function computeLicensePrice(
  teams: number | null | undefined,
): LicensePrice | null {
  if (teams == null || !Number.isFinite(teams) || teams <= 0) return null;
  const n = Math.floor(teams);
  const perTeam = TEAM_RATE;
  const monthly = n * perTeam;
  const annualUndiscounted = monthly * 12;
  const annual = Math.round(annualUndiscounted * (1 - ANNUAL_DISCOUNT));
  return { teams: n, perTeam, monthly, annual, annualUndiscounted, currency: PRICING_CURRENCY };
}
