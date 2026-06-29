"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setCurrentClubId } from "@/lib/club/context";

export async function acceptMyInvitationAction(formData: FormData) {
  const invitationId = String(formData.get("invitationId") ?? "");
  const clubId = String(formData.get("clubId") ?? "");
  if (!invitationId) return { error: "Invitation invalide." };

  const supabase = await createClient();
  // Nouveau chemin (refonte invitations) : matche par target_user_id/email +
  // status, gère kind='staff'. L'ancien accept_my_invitation s'appuyait sur un
  // token en clair qui n'existe plus pour les invitations ciblées.
  const { error } = await supabase.rpc("accept_invitation_by_id", {
    p_invitation_id: invitationId,
  });

  if (error) {
    return { error: error.message };
  }

  // accept_invitation_by_id renvoie l'id d'invitation, pas le club : on bascule
  // le contexte sur le club fourni par my_pending_invitations.
  if (clubId) await setCurrentClubId(clubId);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function rejectMyInvitationAction(formData: FormData) {
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!invitationId) return { error: "Invitation invalide." };

  const supabase = await createClient();
  // Même refonte : reject_invitation_by_id valide target_user_id/email et passe
  // l'invitation en status='revoked'.
  const { error } = await supabase.rpc("reject_invitation_by_id", {
    p_invitation_id: invitationId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}
