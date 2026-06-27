"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setCurrentPersona } from "@/lib/club/persona";

export type InvitationResponseError =
  | "missing_token"
  | "missing_id"
  | "unauthenticated"
  | "invitation_not_found"
  | "invitation_not_pending"
  | "invitation_expired"
  | "email_mismatch"
  | "club_inactive"
  | "already_linked_to_other_player"
  | "rpc_error";

export type InvitationResponseResult =
  | { ok: true; redirectTo?: string }
  | { ok: false; error: InvitationResponseError; message?: string };

function mapRpcError(message: string | undefined): InvitationResponseError {
  if (!message) return "rpc_error";
  if (message.includes("already_linked_to_other_player")) return "already_linked_to_other_player";
  if (message.includes("invitation_not_found")) return "invitation_not_found";
  if (message.includes("invitation_not_pending")) return "invitation_not_pending";
  if (message.includes("invitation_expired")) return "invitation_expired";
  if (message.includes("email_mismatch")) return "email_mismatch";
  if (message.includes("club_inactive")) return "club_inactive";
  if (message.includes("unauthenticated")) return "unauthenticated";
  return "rpc_error";
}

export async function acceptInvitationAction(
  formData: FormData,
): Promise<InvitationResponseResult> {
  const locale = String(formData.get("locale") ?? "fr");
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return { ok: false, error: "missing_token" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { ok: false, error: mapRpcError(error.message), message: error.message };

  await setCurrentPersona("player");
  revalidatePath("/", "layout");
  return { ok: true, redirectTo: `/${locale}/me` };
}

export async function rejectInvitationAction(
  formData: FormData,
): Promise<InvitationResponseResult> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return { ok: false, error: "missing_token" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { error } = await supabase.rpc("reject_invitation", { p_token: token });
  if (error) return { ok: false, error: mapRpcError(error.message), message: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

// /me flow: invitee has only the invitation id (the cleartext token only
// exists in the email URL). Email match still enforced inside the RPC.
export async function acceptInvitationByIdAction(
  formData: FormData,
): Promise<InvitationResponseResult> {
  const locale = String(formData.get("locale") ?? "fr");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "missing_id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: invitation } = await supabase
    .from("club_invitations")
    .select("kind")
    .eq("id", id)
    .maybeSingle<{ kind: "staff" | "player" | "guardian" }>();

  const { error } = await supabase.rpc("accept_invitation_by_id", {
    p_invitation_id: id,
  });
  if (error) return { ok: false, error: mapRpcError(error.message), message: error.message };

  if (invitation?.kind === "guardian") {
    await supabase.from("profiles").update({ can_parent: true }).eq("id", user.id);
    await setCurrentPersona("parent");
  } else if (invitation?.kind === "player") {
    await supabase.from("profiles").update({ can_play: true }).eq("id", user.id);
    await setCurrentPersona("player");
  } else if (invitation?.kind === "staff") {
    await supabase.from("profiles").update({ can_coach: true }).eq("id", user.id);
    await setCurrentPersona("staff");
  }

  revalidatePath("/", "layout");
  return { ok: true, redirectTo: `/${locale}/me` };
}

export async function rejectInvitationByIdAction(
  formData: FormData,
): Promise<InvitationResponseResult> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "missing_id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { error } = await supabase.rpc("reject_invitation_by_id", {
    p_invitation_id: id,
  });
  if (error) return { ok: false, error: mapRpcError(error.message), message: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
