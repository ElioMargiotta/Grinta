import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Request-scoped current user, validated against the Supabase Auth server.
 *
 * `auth.getUser()` performs a network round trip to verify the JWT — unlike
 * `getSession()`, which only reads (and trusts) the cookie. We deliberately
 * keep the validated call: it is the security boundary for every authenticated
 * render. React's `cache()` is scoped to a single request, so wrapping the call
 * here collapses the otherwise-duplicated validation across the render-path
 * helpers (requireUser, getMyMemberships, resolvePersona, isPlatformAdmin) into
 * one round trip, without ever sharing a user between requests.
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export type UserProfile = {
  full_name: string | null;
  persona_preference: string | null;
  can_coach: boolean | null;
  can_play: boolean | null;
  can_parent: boolean | null;
};

/**
 * Request-scoped profile row for the current user. Cached so the layout
 * (display name) and persona resolution (preference) share a single select
 * against `profiles` instead of each issuing its own.
 */
export const getProfile = cache(async (): Promise<UserProfile | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, persona_preference, can_coach, can_play, can_parent")
    .eq("id", user.id)
    .maybeSingle();
  return (data as UserProfile | null) ?? null;
});
