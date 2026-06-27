"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  clearCurrentPersona,
  setCurrentPersona,
} from "@/lib/club/persona";

export async function updatePersonaPreferenceAction(formData: FormData) {
  const capabilities = formData.getAll("capabilities").map(String);
  const canCoach = capabilities.includes("staff");
  const canPlay = capabilities.includes("player");
  const canParent = capabilities.includes("parent");
  if (!canCoach && !canPlay && !canParent) return { error: "invalid" as const };

  const preference = canCoach ? "staff" : canPlay ? "player" : "parent";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" as const };

  const { error } = await supabase
    .from("profiles")
    .update({
      persona_preference: preference,
      can_coach: canCoach,
      can_play: canPlay,
      can_parent: canParent,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  // Drop the per-view cookie when the user narrows their intent — otherwise a
  // stale "staff" cookie would override a fresh "player"-only preference.
  if (canCoach) {
    await setCurrentPersona("staff");
  } else if (canPlay || canParent) {
    await setCurrentPersona("player");
  } else {
    await clearCurrentPersona();
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}

export type UpdateProfileIdentityResult =
  | { ok: true; username: string | null }
  | { ok: false; error: "missing_name" | "invalid_birth_date" | "unauthorized" | "db_error" };

export async function updateProfileIdentityAction(
  formData: FormData,
): Promise<UpdateProfileIdentityResult> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const birthDateRaw = String(formData.get("birthDate") ?? "").trim();

  if (!firstName || !lastName) return { ok: false, error: "missing_name" };
  if (birthDateRaw && Number.isNaN(new Date(birthDateRaw).getTime())) {
    return { ok: false, error: "invalid_birth_date" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { data, error } = await supabase
    .rpc("update_my_profile_identity", {
      p_first_name: firstName,
      p_last_name: lastName,
      p_birth_date: birthDateRaw || null,
      p_phone: phone || null,
    })
    .maybeSingle<{ username: string | null }>();

  if (error) {
    if (error.message?.includes("missing_name")) {
      return { ok: false, error: "missing_name" };
    }
    return { ok: false, error: "db_error" };
  }

  revalidatePath("/", "layout");
  revalidatePath("/account");
  return { ok: true, username: data?.username ?? null };
}

export type SetUsernameResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "taken" | "unauthorized" | "db_error" };

/**
 * Pose/maj le handle public du compte courant via la RPC set_username
 * (validation format + unicité insensible à la casse côté DB). Mappe les
 * exceptions Postgres en codes traduisibles pour l'UI.
 */
export async function setUsernameAction(
  formData: FormData,
): Promise<SetUsernameResult> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { error } = await supabase.rpc("set_username", { p_username: username });
  if (error) {
    if (error.message?.includes("username_taken")) {
      return { ok: false, error: "taken" };
    }
    if (error.message?.includes("username_invalid")) {
      return { ok: false, error: "invalid" };
    }
    return { ok: false, error: "db_error" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
