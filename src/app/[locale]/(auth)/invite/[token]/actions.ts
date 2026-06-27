"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setCurrentClubId } from "@/lib/club/context";
import { setCurrentPersona } from "@/lib/club/persona";

type InvitationPreview = {
  id: string;
  club_id: string;
  kind: "staff" | "player" | "guardian";
  status: "pending" | "accepted" | "revoked" | "expired";
};

export type AcceptInviteError =
  | "missing_token"
  | "unauthenticated"
  | "invitation_not_found"
  | "invitation_not_pending"
  | "invitation_expired"
  | "email_mismatch"
  | "club_inactive"
  | "already_linked_to_other_player"
  | "too_many_guardians"
  | "rpc_error";

function mapError(message: string | undefined): AcceptInviteError {
  if (!message) return "rpc_error";
  if (message.includes("too_many_guardians")) return "too_many_guardians";
  if (message.includes("already_linked_to_other_player")) return "already_linked_to_other_player";
  if (message.includes("invitation_not_found")) return "invitation_not_found";
  if (message.includes("invitation_not_pending")) return "invitation_not_pending";
  if (message.includes("invitation_expired")) return "invitation_expired";
  if (message.includes("email_mismatch")) return "email_mismatch";
  if (message.includes("club_inactive")) return "club_inactive";
  if (message.includes("unauthenticated")) return "unauthenticated";
  return "rpc_error";
}

export async function acceptInvitationAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const locale = String(formData.get("locale") ?? "fr");

  if (!token) return { error: "missing_token" as AcceptInviteError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" as AcceptInviteError };

  const { data: previewRows } = await supabase.rpc("get_invitation", {
    p_token: token,
  });
  const preview = (previewRows as InvitationPreview[] | null)?.[0];
  if (!preview) return { error: "invitation_not_found" as AcceptInviteError };

  // Lien réclamable (Lot B) : aucune contrainte d'email, le compte authentifié
  // rattache la fiche après confirmation d'identité affichée sur la page.
  const { error } = await supabase.rpc("claim_invitation", { p_token: token });
  if (error) return { error: mapError(error.message) };

  if (preview.kind === "staff") {
    await setCurrentClubId(preview.club_id);
    await setCurrentPersona("staff");
    redirect(`/${locale}/dashboard`);
  } else {
    await setCurrentPersona("player");
    redirect(`/${locale}/me`);
  }
}
