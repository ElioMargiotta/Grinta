"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setCurrentClubId } from "@/lib/club/context";

export async function createClubAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const locale = String(formData.get("locale") ?? "fr");

  if (!name) {
    return { error: "Le nom du club est requis." };
  }
  if (name.length > 80) {
    return { error: "Le nom du club est trop long (max 80 caractères)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Non authentifié." };
  }

  const { data: clubId, error } = await supabase.rpc("create_club", {
    p_name: name,
  });

  if (error || !clubId) {
    return { error: error?.message ?? "Échec de la création du club." };
  }

  await setCurrentClubId(clubId as string);
  redirect(`/${locale}/dashboard`);
}
