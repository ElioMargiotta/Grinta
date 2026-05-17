import "server-only";
import { cookies } from "next/headers";
import { getMyMemberships, getMembershipForClub } from "./queries";
import type { ClubMembership } from "./types";

const CURRENT_CLUB_COOKIE = "grinta_current_club";
const COOKIE_MAX_AGE_DAYS = 365;

export async function getCurrentClubId(): Promise<string | null> {
  const store = await cookies();
  return store.get(CURRENT_CLUB_COOKIE)?.value ?? null;
}

export async function setCurrentClubId(clubId: string): Promise<void> {
  const store = await cookies();
  store.set(CURRENT_CLUB_COOKIE, clubId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * COOKIE_MAX_AGE_DAYS,
  });
}

export async function clearCurrentClubId(): Promise<void> {
  const store = await cookies();
  store.delete(CURRENT_CLUB_COOKIE);
}

/**
 * Resolves the current membership for this request:
 *   1. cookie → matching membership (still valid)
 *   2. fallback: first membership (and pin it in the cookie)
 *   3. null if user has no memberships
 */
export async function resolveCurrentMembership(): Promise<ClubMembership | null> {
  const memberships = await getMyMemberships();
  if (memberships.length === 0) return null;

  const cookieClubId = await getCurrentClubId();
  if (cookieClubId) {
    const fromCookie = await getMembershipForClub(cookieClubId);
    if (fromCookie) return fromCookie;
  }

  const fallback = memberships[0];
  await setCurrentClubId(fallback.club_id);
  return fallback;
}
