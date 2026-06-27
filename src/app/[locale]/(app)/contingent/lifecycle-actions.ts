"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentMembership } from "@/lib/club/context";

export type PlayerStatus = "active" | "inactive" | "left" | "archived";

type SimpleResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "forbidden" | "not_found" | "db_error" };

async function requireClub(locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);
  return { supabase, membership };
}

/** Délie le compte joueur (self) d'une fiche — mis-claim ou transfert. */
export async function unlinkPlayerAccountAction(
  formData: FormData,
): Promise<SimpleResult> {
  const locale = String(formData.get("locale") ?? "fr");
  const playerId = String(formData.get("playerId") ?? "").trim();
  if (!playerId) return { ok: false, error: "not_found" };

  const { supabase } = await requireClub(locale);
  const { error } = await supabase.rpc("unlink_player_account", {
    p_player_id: playerId,
  });
  if (error) {
    if (error.message?.includes("forbidden")) return { ok: false, error: "forbidden" };
    return { ok: false, error: "db_error" };
  }
  revalidatePath(`/${locale}/contingent/${playerId}`);
  return { ok: true };
}

/**
 * Change le statut de cycle de vie d'une fiche. RLS players (club-scoped,
 * full/extended) autorise l'update. left/archived posent left_at = aujourd'hui ;
 * un retour à active le réinitialise.
 */
export async function setPlayerStatusAction(
  formData: FormData,
): Promise<SimpleResult> {
  const locale = String(formData.get("locale") ?? "fr");
  const playerId = String(formData.get("playerId") ?? "").trim();
  const raw = String(formData.get("status") ?? "");
  const status = (["active", "inactive", "left", "archived"] as const).includes(
    raw as PlayerStatus,
  )
    ? (raw as PlayerStatus)
    : null;
  if (!playerId || !status) return { ok: false, error: "not_found" };

  const { supabase, membership } = await requireClub(locale);
  const leftAt = status === "left" || status === "archived"
    ? new Date().toISOString().slice(0, 10)
    : null;

  const { error } = await supabase
    .from("players")
    .update({ status, left_at: leftAt })
    .eq("id", playerId)
    .eq("club_id", membership.club_id);
  if (error) return { ok: false, error: "db_error" };

  revalidatePath(`/${locale}/contingent/${playerId}`);
  revalidatePath(`/${locale}/contingent`);
  return { ok: true };
}

/** Retire un lien parent/tuteur d'une fiche (RLS player_guardians, staff). */
export async function removeGuardianAction(
  formData: FormData,
): Promise<SimpleResult> {
  const locale = String(formData.get("locale") ?? "fr");
  const playerId = String(formData.get("playerId") ?? "").trim();
  const guardianId = String(formData.get("guardianId") ?? "").trim();
  if (!guardianId) return { ok: false, error: "not_found" };

  const { supabase } = await requireClub(locale);
  const { error } = await supabase
    .from("player_guardians")
    .delete()
    .eq("id", guardianId);
  if (error) return { ok: false, error: "db_error" };

  if (playerId) revalidatePath(`/${locale}/contingent/${playerId}`);
  return { ok: true };
}
