"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  clearCurrentPersona,
  setCurrentPersona,
  type PersonaPreference,
} from "@/lib/club/persona";

function normalize(value: FormDataEntryValue | null): PersonaPreference | null {
  const v = String(value ?? "");
  if (v === "staff" || v === "player" || v === "dual") return v;
  return null;
}

export async function updatePersonaPreferenceAction(formData: FormData) {
  const preference = normalize(formData.get("personaPreference"));
  if (!preference) return { error: "invalid" as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" as const };

  const { error } = await supabase
    .from("profiles")
    .update({ persona_preference: preference })
    .eq("id", user.id);
  if (error) return { error: error.message };

  // Drop the per-view cookie when the user narrows their intent — otherwise a
  // stale "staff" cookie would override a fresh "player"-only preference.
  if (preference === "staff") {
    await setCurrentPersona("staff");
  } else if (preference === "player") {
    await setCurrentPersona("player");
  } else {
    await clearCurrentPersona();
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}
