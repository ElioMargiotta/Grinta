"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentMembership } from "@/lib/club/context";

type PlayerInput = {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  position: string | null;
  jerseyNumber: number | null;
  notes: string | null;
};

function readPlayer(formData: FormData): PlayerInput {
  const jerseyRaw = String(formData.get("jerseyNumber") ?? "").trim();
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    birthDate: String(formData.get("birthDate") ?? "") || null,
    position: String(formData.get("position") ?? "").trim() || null,
    jerseyNumber: jerseyRaw ? Number(jerseyRaw) : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

/**
 * Club-level player creation — no team required (#38). The player is attached
 * to the currently selected club; team affectation is handled separately
 * through player_team_assignments (#39).
 */
export async function createClubPlayerAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "fr");
  const input = readPlayer(formData);
  if (!input.firstName || !input.lastName) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);

  const { error } = await supabase.from("players").insert({
    club_id: membership.club_id,
    first_name: input.firstName,
    last_name: input.lastName,
    birth_date: input.birthDate,
    position: input.position,
    jersey_number: input.jerseyNumber,
    notes: input.notes,
  });

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/contingent`);
}

export async function updateClubPlayerAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "fr");
  const playerId = String(formData.get("playerId") ?? "");
  const input = readPlayer(formData);
  if (!playerId || !input.firstName || !input.lastName) {
    return { error: "Missing fields" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase
    .from("players")
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      birth_date: input.birthDate,
      position: input.position,
      jersey_number: input.jerseyNumber,
      notes: input.notes,
    })
    .eq("id", playerId);

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/contingent`);
  revalidatePath(`/${locale}/contingent/${playerId}`);
}

export async function deleteClubPlayerAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "fr");
  const playerId = String(formData.get("playerId") ?? "");
  if (!playerId) return { error: "Missing player" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/contingent`);
  redirect(`/${locale}/contingent`);
}
