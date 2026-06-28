import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/user";
import { mfaChallengeRequired } from "@/lib/auth/mfa";
import { resolveCurrentMembership } from "@/lib/club/context";
import { resolvePersona, type Persona } from "@/lib/club/persona";

export async function requireUser(locale: string) {
  const supabase = await createClient();
  const user = await getAuthUser();

  if (!user) redirect(`/${locale}/login`);

  // 2FA opt-in : si le compte a un facteur TOTP vérifié mais que la session
  // est encore en aal1, on bloque tout l'app derrière le challenge /mfa.
  // (Les comptes sans 2FA ont nextLevel = aal1 → jamais redirigés.)
  if (await mfaChallengeRequired()) {
    redirect(`/${locale}/mfa`);
  }

  return { supabase, user };
}

export async function requireMembership(locale: string) {
  const { supabase, user } = await requireUser(locale);
  const membership = await resolveCurrentMembership();
  if (!membership) {
    redirect(`/${locale}/onboarding/club`);
  }
  return { supabase, user, membership };
}

/**
 * Enforces that the active persona matches the expected one. Redirects to the
 * other side's landing if the user is currently in the wrong view, or to login
 * / onboarding if no persona is available. Used by route-group layouts to keep
 * staff routes and player routes disjoint.
 */
export async function requirePersona(locale: string, expected: Persona) {
  const { supabase, user } = await requireUser(locale);
  const persona = await resolvePersona();
  // persona is non-null now: unaffiliated users resolve to active="player"
  // (see resolvePersona). They can still land on /me even with no club.
  if (!persona) redirect(`/${locale}/login`);
  if (persona.active !== expected) {
    redirect(`/${locale}/${persona.active === "staff" ? "dashboard" : "me"}`);
  }
  return { supabase, user, persona };
}

/**
 * True when the current user is a Grinta platform operator (super-admin).
 * Cached per request; safe to call from layouts and nav components.
 */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const user = await getAuthUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
});

/** Gate the admin area: only platform operators may enter. */
export async function requirePlatformAdmin(locale: string) {
  const { supabase, user } = await requireUser(locale);
  if (!(await isPlatformAdmin())) {
    redirect(`/${locale}/dashboard`);
  }
  return { supabase, user };
}
