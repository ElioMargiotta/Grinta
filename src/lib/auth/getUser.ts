import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentMembership } from "@/lib/club/context";
import { resolvePersona, type Persona } from "@/lib/club/persona";

export async function requireUser(locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);
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
  if (!persona) {
    redirect(`/${locale}/onboarding/club`);
  }
  if (persona.active !== expected) {
    redirect(`/${locale}/${persona.active === "staff" ? "dashboard" : "me"}`);
  }
  return { supabase, user, persona };
}
