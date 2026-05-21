"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { setCurrentPersona, type Persona } from "@/lib/club/persona";

const LOCALE_COOKIE = "NEXT_LOCALE";

export async function switchPersonaAction(persona: Persona): Promise<void> {
  if (persona !== "staff" && persona !== "player") return;
  await setCurrentPersona(persona);
  revalidatePath("/", "layout");

  const store = await cookies();
  const locale = store.get(LOCALE_COOKIE)?.value ?? "fr";
  redirect(`/${locale}/${persona === "staff" ? "dashboard" : "me"}`);
}
