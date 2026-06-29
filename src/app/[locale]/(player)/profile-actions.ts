"use server";

import { revalidatePath } from "next/cache";
import { getLinkedPlayers, setActivePlayerCookie } from "@/lib/player/profiles";

/**
 * Sélection du profil actif du portail joueur/parent (Lot E). On valide l'id
 * contre la liste des profils réellement liés au compte avant de poser le
 * cookie — un id arbitraire est ignoré (la RLS protège déjà les données).
 */
export async function setActivePlayerAction(formData: FormData) {
  const playerId = String(formData.get("playerId") ?? "").trim();
  if (!playerId) return { ok: false as const };

  const linked = await getLinkedPlayers();
  if (!linked.some((p) => p.playerId === playerId)) {
    return { ok: false as const };
  }

  await setActivePlayerCookie(playerId);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
