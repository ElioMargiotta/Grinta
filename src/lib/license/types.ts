// Licence model shared types. The DB is the source of truth: `state` is
// computed by public.club_license_state() and the usage snapshot comes from
// public.club_license_usage(). See migrations 20260625100100/100200.

export type LicenseState = "active" | "grace" | "locked";
export type LicenseStatus = "active" | "suspended" | "expired";

export type LicenseUsage = {
  state: LicenseState;
  status: LicenseStatus;
  auto_renew: boolean;
  starts_at: string | null;
  ends_at: string | null;
  grace_days: number;
  quote_reference: string | null;
  teams: number;
  players: number;
  staff: number;
  max_teams: number | null;
  max_players: number | null;
  max_staff: number | null;
};

/** Writes are only allowed while the licence is fully active. */
export function isWritable(state: LicenseState): boolean {
  return state === "active";
}

/** A null cap means unlimited. */
export function quotaReached(used: number, max: number | null): boolean {
  return max !== null && used >= max;
}

/** Maps a Postgres RPC error message to a stable client-side error code. */
export function licenseErrorCode(message: string | null | undefined): string | null {
  if (!message) return null;
  for (const code of [
    "team_quota_reached",
    "player_quota_reached",
    "staff_quota_reached",
    "license_not_writable",
    "club_inactive",
  ]) {
    if (message.includes(code)) return code;
  }
  return null;
}

const LICENSE_ERROR_FR: Record<string, string> = {
  team_quota_reached:
    "Quota d'équipes atteint pour la licence de ce club. Contacte l'administrateur pour l'étendre.",
  player_quota_reached:
    "Quota de joueurs atteint pour la licence de ce club. Contacte l'administrateur pour l'étendre.",
  staff_quota_reached:
    "Quota de membres du staff atteint pour la licence de ce club. Contacte l'administrateur pour l'étendre.",
  license_not_writable:
    "La licence du club est en lecture seule. Aucune modification n'est possible.",
  club_inactive:
    "La licence du club est en lecture seule. Aucune modification n'est possible.",
};

/**
 * Returns a user-facing French message for a licence/quota DB error, or the
 * original message when it is not a known licence error. Server-action safe.
 */
export function licenseErrorMessage(message: string | null | undefined): string {
  const code = licenseErrorCode(message);
  if (code && LICENSE_ERROR_FR[code]) return LICENSE_ERROR_FR[code];
  return message ?? "Une erreur est survenue.";
}
