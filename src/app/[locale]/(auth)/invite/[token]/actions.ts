"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setCurrentClubId } from "@/lib/club/context";

export async function acceptInvitationAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const locale = String(formData.get("locale") ?? "fr");

  if (!token) return { error: "Jeton manquant." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Connecte-toi pour accepter l'invitation." };
  }

  const { data: clubId, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });

  if (error || !clubId) {
    return { error: error?.message ?? "Échec de l'acceptation." };
  }

  await setCurrentClubId(clubId as string);
  redirect(`/${locale}/dashboard`);
}
