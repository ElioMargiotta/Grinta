import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentMembership } from "@/lib/club/context";

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
