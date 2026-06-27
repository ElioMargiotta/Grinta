import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/auth/user";
import { resolveCurrentMembership } from "./context";

export type Persona = "staff" | "player";
export type PersonaAvailability = "staff" | "player" | "dual";
// 'parent' = compte tuteur : vue portail joueur (gère les fiches de ses enfants).
export type PersonaPreference = "staff" | "player" | "dual" | "parent";

const CURRENT_PERSONA_COOKIE = "grinta_current_persona";
const COOKIE_MAX_AGE_DAYS = 365;

export type PersonaState = {
  available: PersonaAvailability;
  active: Persona;
  playerId: string | null;
  playerClubId: string | null;
  // Stated intent from signup (or account settings). Drives switcher
  // availability for unaffiliated accounts — when "dual" the user can flip
  // views before joining a club or being registered as a player.
  preference: PersonaPreference;
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

function normalizePreference(value: unknown): PersonaPreference {
  return value === "player" || value === "dual" || value === "parent"
    ? value
    : "staff";
}

/**
 * Resolves the active persona for the current user.
 *
 * The stated preference is authoritative — it alone decides which sides are
 * available. Data presence (membership, players row) only feeds the
 * playerId / playerClubId fields used by the player view.
 *
 *   - preference "staff"  → available "staff", locked to /dashboard.
 *   - preference "player" → available "player", locked to /me.
 *   - preference "dual"   → available "dual", switcher visible. Cookie picks
 *                           the active side, defaulting to "staff".
 */
export const resolvePersona = cache(async (): Promise<PersonaState | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  // resolveCurrentMembership is awaited for its side-effect of pinning the
  // current club cookie when one isn't set yet. getProfile is request-cached
  // and shared with the layout, so it costs no extra round trip here.
  const [, { data: playerRow }, profile] = await Promise.all([
    resolveCurrentMembership(),
    supabase
      .from("players")
      .select("id, club_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    getProfile(),
  ]);

  const preference = normalizePreference(profile?.persona_preference);
  const cookiePersona = await getCurrentPersona();

  let available: PersonaAvailability;
  let active: Persona;
  if (preference === "dual") {
    available = "dual";
    active = cookiePersona ?? "staff";
  } else if (preference === "player" || preference === "parent") {
    // Le parent utilise le portail joueur (il gère les fiches de ses enfants).
    available = "player";
    active = "player";
  } else {
    available = "staff";
    active = "staff";
  }

  return {
    available,
    active,
    playerId: playerRow?.id ?? null,
    playerClubId: playerRow?.club_id ?? null,
    preference,
  };
});
