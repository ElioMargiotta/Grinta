"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parseEquipment(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createExerciseAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  const durationRaw = String(formData.get("duration") ?? "").trim();
  const duration = durationRaw ? Number(durationRaw) : null;
  const intensity = String(formData.get("intensity") ?? "").trim() || null;
  const equipment = parseEquipment(String(formData.get("equipment") ?? ""));
  const locale = String(formData.get("locale") ?? "en");

  if (!name) return { error: "Name is required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.from("exercises").insert({
    trainer_id: user.id,
    name,
    description,
    category,
    duration_minutes: duration,
    intensity,
    equipment,
  });

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/exercises`);
  redirect(`/${locale}/exercises`);
}

export async function updateExerciseAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  const durationRaw = String(formData.get("duration") ?? "").trim();
  const duration = durationRaw ? Number(durationRaw) : null;
  const intensity = String(formData.get("intensity") ?? "").trim() || null;
  const equipment = parseEquipment(String(formData.get("equipment") ?? ""));
  const locale = String(formData.get("locale") ?? "en");

  if (!id || !name) return { error: "Missing fields" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("exercises")
    .update({
      name,
      description,
      category,
      duration_minutes: duration,
      intensity,
      equipment,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/exercises`);
  redirect(`/${locale}/exercises`);
}

export async function deleteExerciseAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  if (!id) return { error: "Missing id" };

  const supabase = await createClient();
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/exercises`);
  redirect(`/${locale}/exercises`);
}
