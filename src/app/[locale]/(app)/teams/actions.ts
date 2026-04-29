"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createTeamAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const season = String(formData.get("season") ?? "").trim() || null;
  const ageGroup = String(formData.get("ageGroup") ?? "").trim() || null;
  const locale = String(formData.get("locale") ?? "en");

  if (!name) return { error: "Name is required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data, error } = await supabase
    .from("teams")
    .insert({ trainer_id: user.id, name, season, age_group: ageGroup })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/teams`);
  redirect(`/${locale}/teams/${data.id}`);
}

export async function createPlayerAction(formData: FormData) {
  const teamId = String(formData.get("teamId") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "") || null;
  const position = String(formData.get("position") ?? "").trim() || null;
  const jerseyRaw = String(formData.get("jerseyNumber") ?? "").trim();
  const jerseyNumber = jerseyRaw ? Number(jerseyRaw) : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const locale = String(formData.get("locale") ?? "en");

  if (!teamId || !firstName || !lastName) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.from("players").insert({
    team_id: teamId,
    trainer_id: user.id,
    first_name: firstName,
    last_name: lastName,
    birth_date: birthDate,
    position,
    jersey_number: jerseyNumber,
    notes,
  });

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/teams/${teamId}/players`);
}
