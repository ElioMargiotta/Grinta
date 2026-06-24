"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveMicrocycleId(
  supabase: SupabaseClient,
  teamId: string,
  date: string,
): Promise<string | null> {
  const { data: macros } = await supabase
    .from("macrocycles")
    .select("id")
    .eq("team_id", teamId);
  const macroIds = (macros ?? []).map((m) => m.id as string);
  if (!macroIds.length) return null;

  const { data: mesos } = await supabase
    .from("mesocycles")
    .select("id")
    .in("macrocycle_id", macroIds);
  const mesoIds = (mesos ?? []).map((m) => m.id as string);
  if (!mesoIds.length) return null;

  const { data: micros } = await supabase
    .from("microcycles")
    .select("id, start_date")
    .in("mesocycle_id", mesoIds)
    .lte("start_date", date)
    .order("start_date", { ascending: false })
    .limit(1);

  const candidate = (micros ?? [])[0] as
    | { id: string; start_date: string }
    | undefined;
  if (!candidate) return null;

  const start = new Date(candidate.start_date);
  const target = new Date(date);
  const diffDays = Math.floor(
    (target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diffDays >= 0 && diffDays < 7 ? candidate.id : null;
}

type SessionPayload = {
  teamId: string;
  date: string;
  startTime: string | null;
  duration: number | null;
  theme: string | null;
  location: string | null;
  notes: string | null;
  rsvpDeadlineHours: number;
};

function readSessionFields(formData: FormData): SessionPayload {
  const rawDeadline = formData.get("rsvpDeadlineHours");
  const deadline = rawDeadline === null || rawDeadline === ""
    ? 24
    : Math.max(0, Math.min(168, Math.round(Number(rawDeadline))));
  return {
    teamId: String(formData.get("teamId") ?? ""),
    date: String(formData.get("date") ?? ""),
    startTime: String(formData.get("startTime") ?? "") || null,
    duration: formData.get("duration") ? Number(formData.get("duration")) : null,
    theme: String(formData.get("theme") ?? "").trim() || null,
    location: String(formData.get("location") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    rsvpDeadlineHours: Number.isFinite(deadline) ? deadline : 24,
  };
}

function slotOf(time: string | null): "morning" | "afternoon" {
  if (!time) return "morning";
  const hh = Number(time.slice(0, 2));
  return hh < 12 ? "morning" : "afternoon";
}

const SLOT_DEFAULT_TIME: Record<"morning" | "afternoon", string> = {
  morning: "10:00",
  afternoon: "16:00",
};
const DEFAULT_SESSION_DURATION = 90;

export async function createSessionForSlotAction({
  teamId,
  date,
  slot,
  locale,
}: {
  teamId: string;
  date: string;
  slot: "morning" | "afternoon";
  locale: string;
}) {
  if (!teamId || !date) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: sameDay } = await supabase
    .from("sessions")
    .select("id, start_time")
    .eq("team_id", teamId)
    .eq("date", date);
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

  const microcycleId = await resolveMicrocycleId(supabase, teamId, date);

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      team_id: teamId,
      trainer_id: user.id,
      date,
      start_time: SLOT_DEFAULT_TIME[slot],
      duration_minutes: DEFAULT_SESSION_DURATION,
      theme: null,
      notes: null,
      microcycle_id: microcycleId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${teamId}`);
  redirect(`/${locale}/planner/${teamId}/sessions/${data.id}/preparation`);
}

/**
 * Crée une éval physique (kind = 'physical_eval') sur le planning d'une équipe
 * à une date donnée, avec les tests choisis. Une seule éval par équipe/jour.
 * Redirige vers la page présences pour la saisie des résultats.
 */
export async function createPhysicalTestAction({
  teamId,
  date,
  metricIds,
  locale,
}: {
  teamId: string;
  date: string;
  metricIds: string[];
  locale: string;
}) {
  if (!teamId || !date) return { error: "Missing fields" };
  if (!metricIds || metricIds.length === 0) return { error: "No test selected" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: team } = await supabase
    .from("teams")
    .select("id, club_id")
    .eq("id", teamId)
    .single();
  if (!team?.club_id) return { error: "Not found" };

  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("team_id", teamId)
    .eq("date", date)
    .eq("kind", "physical_eval")
    .maybeSingle();
  if (existing) {
    return { error: "An evaluation already exists for this day." };
  }

  const { data: created, error } = await supabase
    .from("sessions")
    .insert({
      team_id: teamId,
      trainer_id: user.id,
      date,
      start_time: null,
      duration_minutes: null,
      theme: null,
      notes: null,
      kind: "physical_eval",
      microcycle_id: null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const rows = metricIds.map((metricId) => ({
    club_id: team.club_id,
    session_id: created.id,
    metric_id: metricId,
    created_by: user.id,
  }));
  const { error: testsError } = await supabase
    .from("session_physical_tests")
    .insert(rows);
  if (testsError) return { error: testsError.message };

  revalidatePath(`/${locale}/planner/${teamId}`);
  redirect(`/${locale}/planner/${teamId}/sessions/${created.id}/test`);
}

export async function cancelSessionAction({
  teamId,
  sessionId,
  locale,
}: {
  teamId: string | null;
  sessionId: string;
  locale: string;
}) {
  if (!sessionId) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) return { error: error.message };

  if (teamId) {
    revalidatePath(`/${locale}/planner/${teamId}`);
    redirect(`/${locale}/planner/${teamId}`);
  } else {
    revalidatePath(`/${locale}/sessions`);
    redirect(`/${locale}/sessions`);
  }
}

export async function movePlannerSessionAction({
  teamId,
  sessionId,
  date,
  slot,
  locale,
}: {
  teamId: string;
  sessionId: string;
  date: string;
  slot: "morning" | "afternoon";
  locale: string;
}) {
  if (!teamId || !sessionId || !date) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: source } = await supabase
    .from("sessions")
    .select("id, trainer_id, team_id")
    .eq("id", sessionId)
    .single();
  if (!source || source.trainer_id !== user.id || source.team_id !== teamId) {
    return { error: "Not found" };
  }

  const { data: sameDay } = await supabase
    .from("sessions")
    .select("id, start_time")
    .eq("team_id", teamId)
    .eq("date", date);
  if (
    (sameDay ?? []).some(
      (s) =>
        s.id !== sessionId &&
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

  const microcycleId = await resolveMicrocycleId(supabase, teamId, date);
  const { error } = await supabase
    .from("sessions")
    .update({
      date,
      start_time: SLOT_DEFAULT_TIME[slot],
      microcycle_id: microcycleId,
    })
    .eq("id", sessionId);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${teamId}`);
}

export async function duplicatePlannerSessionAction({
  teamId,
  sessionId,
  date,
  slot,
  locale,
}: {
  teamId: string;
  sessionId: string;
  date: string;
  slot: "morning" | "afternoon";
  locale: string;
}) {
  if (!teamId || !sessionId || !date) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: source } = await supabase
    .from("sessions")
    .select("id, team_id, trainer_id, date, start_time, duration_minutes, theme, notes")
    .eq("id", sessionId)
    .single();
  if (!source || source.trainer_id !== user.id || source.team_id !== teamId) {
    return { error: "Not found" };
  }

  const { data: sameDay } = await supabase
    .from("sessions")
    .select("id, start_time")
    .eq("team_id", teamId)
    .eq("date", date);
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

  const microcycleId = await resolveMicrocycleId(supabase, teamId, date);
  const { data: created, error } = await supabase
    .from("sessions")
    .insert({
      team_id: teamId,
      trainer_id: user.id,
      date,
      start_time: SLOT_DEFAULT_TIME[slot],
      duration_minutes: source.duration_minutes,
      theme: source.theme,
      notes: source.notes,
      microcycle_id: microcycleId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { data: preparation } = await supabase
    .from("session_preparations")
    .select("data")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (preparation?.data) {
    const copiedPreparation =
      typeof preparation.data === "object" && preparation.data !== null
        ? { ...preparation.data, date }
        : preparation.data;
    const { error: prepError } = await supabase
      .from("session_preparations")
      .insert({
        session_id: created.id,
        trainer_id: user.id,
        data: copiedPreparation,
        updated_at: new Date().toISOString(),
      });
    if (prepError) return { error: prepError.message };
  }

  revalidatePath(`/${locale}/planner/${teamId}`);
}

export async function deletePlannerSessionAction({
  teamId,
  sessionId,
  locale,
}: {
  teamId: string;
  sessionId: string;
  locale: string;
}) {
  if (!teamId || !sessionId) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("team_id", teamId)
    .eq("trainer_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${teamId}`);
}

export async function createSessionAction(formData: FormData) {
  const fields = readSessionFields(formData);
  const locale = String(formData.get("locale") ?? "fr");

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
      location: fields.location,
      notes: fields.notes,
      rsvp_deadline_hours: fields.rsvpDeadlineHours,
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
  const locale = String(formData.get("locale") ?? "fr");
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
      location: fields.location,
      notes: fields.notes,
      rsvp_deadline_hours: fields.rsvpDeadlineHours,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${fields.teamId}`);
  revalidatePath(`/${locale}/planner/${fields.teamId}/sessions/${id}`);
}
