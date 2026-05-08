"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SessionPayload = {
  teamId: string;
  date: string;
  startTime: string | null;
  duration: number | null;
  theme: string | null;
  notes: string | null;
};

function readSessionFields(formData: FormData): SessionPayload {
  return {
    teamId: String(formData.get("teamId") ?? ""),
    date: String(formData.get("date") ?? ""),
    startTime: String(formData.get("startTime") ?? "") || null,
    duration: formData.get("duration") ? Number(formData.get("duration")) : null,
    theme: String(formData.get("theme") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

function slotOf(time: string | null): "morning" | "afternoon" {
  if (!time) return "morning";
  const hh = Number(time.slice(0, 2));
  return hh < 12 ? "morning" : "afternoon";
}

export async function createSessionAction(formData: FormData) {
  const fields = readSessionFields(formData);
  const locale = String(formData.get("locale") ?? "en");

  if (!fields.teamId || !fields.date) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const slot = slotOf(fields.startTime);
  const { data: sameDay } = await supabase
    .from("sessions")
    .select("id, start_time")
    .eq("team_id", fields.teamId)
    .eq("date", fields.date);
  if (
    (sameDay ?? []).some(
      (s) => slotOf((s.start_time as string | null) ?? null) === slot,
    )
  ) {
    return {
      error:
        slot === "morning"
          ? "A morning session already exists for this day."
          : "An afternoon session already exists for this day.",
    };
  }

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      team_id: fields.teamId,
      trainer_id: user.id,
      date: fields.date,
      start_time: fields.startTime,
      duration_minutes: fields.duration,
      theme: fields.theme,
      notes: fields.notes,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${fields.teamId}`);
  redirect(`/${locale}/planner/${fields.teamId}/sessions/${data.id}`);
}

export async function updateSessionAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const fields = readSessionFields(formData);
  const locale = String(formData.get("locale") ?? "en");
  if (!id) return { error: "Missing id" };

  const supabase = await createClient();

  const slot = slotOf(fields.startTime);
  const { data: sameDay } = await supabase
    .from("sessions")
    .select("id, start_time")
    .eq("team_id", fields.teamId)
    .eq("date", fields.date);
  if (
    (sameDay ?? []).some(
      (s) =>
        s.id !== id &&
        slotOf((s.start_time as string | null) ?? null) === slot,
    )
  ) {
    return {
      error:
        slot === "morning"
          ? "A morning session already exists for this day."
          : "An afternoon session already exists for this day.",
    };
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      date: fields.date,
      start_time: fields.startTime,
      duration_minutes: fields.duration,
      theme: fields.theme,
      notes: fields.notes,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${fields.teamId}`);
  revalidatePath(`/${locale}/planner/${fields.teamId}/sessions/${id}`);
}

export async function deleteSessionAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  if (!id) return { error: "Missing id" };

  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${teamId}`);
  redirect(`/${locale}/planner/${teamId}`);
}

export async function attachExerciseAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const exerciseId = String(formData.get("exerciseId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  if (!sessionId || !exerciseId) return { error: "Missing fields" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("session_exercises")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const { error } = await supabase.from("session_exercises").insert({
    session_id: sessionId,
    exercise_id: exerciseId,
    order_index: count ?? 0,
  });
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}`);
}

export async function detachExerciseAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const locale = String(formData.get("locale") ?? "en");
  if (!id) return { error: "Missing id" };

  const supabase = await createClient();
  const { error } = await supabase.from("session_exercises").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}`);
}
