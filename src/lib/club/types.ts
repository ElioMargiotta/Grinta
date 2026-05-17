export type AccessLevel = "full" | "extended" | "team" | "team_readonly";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "paused";

export type ClubThemeMode = "day" | "night";

export type ClubIdentity = {
  logo_url: string | null;
  theme_mode: ClubThemeMode;
  theme_primary_color: string;
  theme_secondary_color: string;
  theme_night_primary_color: string;
  theme_night_secondary_color: string;
};

export type ClubMembership = {
  club_id: string;
  club_name: string;
  role_id: string;
  role_name: string;
  access_level: AccessLevel;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
} & ClubIdentity;

export const ACCESS_LEVELS: AccessLevel[] = [
  "full",
  "extended",
  "team",
  "team_readonly",
];

export function isClubWideLevel(level: AccessLevel): boolean {
  return level === "full" || level === "extended";
}

export function isTeamScopedLevel(level: AccessLevel): boolean {
  return level === "team" || level === "team_readonly";
}

export function canWrite(level: AccessLevel): boolean {
  return level !== "team_readonly";
}

export function canManageClub(level: AccessLevel): boolean {
  return level === "full";
}

export function canManageTeams(level: AccessLevel): boolean {
  return level === "full" || level === "extended";
}
