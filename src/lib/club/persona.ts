import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentMembership } from "./context";

export type Persona = "staff" | "player";
export type PersonaAvailability = "staff" | "player" | "dual";

const CURRENT_PERSONA_COOKIE = "grinta_current_persona";
const COOKIE_MAX_AGE_DAYS = 365;

export type PersonaState = {
  available: PersonaAvailability;
  active: Persona;
  playerId: string | null;
  playerClubId: string | null;
};

export async function getCurrentPersona(): Promise<Persona | null> {
  const store = await cookies();
  const value = store.get(CURRENT_PERSONA_COOKIE)?.value;
  return value === "staff" || value === "player" ? value : null;
}

export async function setCurrentPersona(persona: Persona): Promise<void> {
  const store = await cookies();
  try {
    store.set(CURRENT_PERSONA_COOKIE, persona, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * COOKIE_MAX_AGE_DAYS,
    });
  } catch {
    // Cookie writes are illegal in Server Component renders; the active
    // persona still resolves via the fallback rule. Server Actions persist it.
  }
}

export async function clearCurrentPersona(): Promise<void> {
  const store = await cookies();
  try {
    store.delete(CURRENT_PERSONA_COOKIE);
  } catch {
    // Safe to ignore outside Server Action / Route Handler.
  }
}

/**
 * Looks up the persona state for the current user.
 *   - playerId / playerClubId are non-null iff a `players` row exists with
 *     this user_id (#35 bridge). We pick the first match — the unique index
 *     `(club_id, user_id)` guarantees at most one per club, but a single
 *     account COULD be linked to player rows in multiple clubs. The current
 *     club cookie still drives which data is shown; the player identity is
 *     just "exists or not" at the account level.
 *   - available: "staff" if only memberships, "player" if only player row,
 *     "dual" if both.
 *   - active: cookie value if valid AND available, else the only side, else
 *     "staff" when dual without preference.
 */
export const resolvePersona = cache(async (): Promise<PersonaState | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [membership, { data: playerRow }] = await Promise.all([
    resolveCurrentMembership(),
    supabase
      .from("players")
      .select("id, club_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  const isStaff = membership !== null;
  const isPlayer = playerRow !== null;

  if (!isStaff && !isPlayer) return null;

  const available: PersonaAvailability = isStaff && isPlayer
    ? "dual"
    : isStaff
      ? "staff"
      : "player";

  const cookiePersona = await getCurrentPersona();
  let active: Persona;
  if (available === "dual") {
    active = cookiePersona ?? "staff";
  } else {
    active = available;
  }

  return {
    available,
    active,
    playerId: playerRow?.id ?? null,
    playerClubId: playerRow?.club_id ?? null,
  };
});
