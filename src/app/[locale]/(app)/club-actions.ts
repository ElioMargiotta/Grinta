"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setCurrentClubId } from "@/lib/club/context";

export async function switchClubAction(formData: FormData) {
  const clubId = String(formData.get("clubId") ?? "");
  if (!clubId) return { error: "ID club manquant." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  // Verify the user is actually a member of this club (RLS would also block,
  // but we want a clean error before redirecting).
  const { data: membership } = await supabase
    .from("club_memberships")
    .select("club_id")
    .eq("user_id", user.id)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!membership) return { error: "Tu n'es pas membre de ce club." };

  await setCurrentClubId(clubId);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
