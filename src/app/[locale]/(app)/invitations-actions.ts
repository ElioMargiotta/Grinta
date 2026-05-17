"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setCurrentClubId } from "@/lib/club/context";

export async function acceptMyInvitationAction(formData: FormData) {
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!invitationId) return { error: "Invitation invalide." };

  const supabase = await createClient();
  const { data: clubId, error } = await supabase.rpc("accept_my_invitation", {
    p_invitation_id: invitationId,
  });

  if (error || !clubId) {
    return { error: error?.message ?? "Échec de l'acceptation." };
  }

  await setCurrentClubId(clubId as string);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
