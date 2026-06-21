"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type MetricFields, metricFieldsToRow } from "@/lib/physical/defaultLibrary";

async function requireUser(locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  return { supabase, user };
}

/** Club du joueur — toutes les écritures se rattachent à ce club. */
async function playerClub(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerId: string,
) {
  const { data, error } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("id", playerId)
    .single();
  if (error || !data) return null;
  return data;
}

/** Séance → club + date (toutes les écritures liées à une séance s'y rattachent). */
async function sessionClub(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, date, teams(club_id)")
    .eq("id", sessionId)
    .single();
  if (error || !data) return null;
  const rel = (data as unknown as { teams?: { club_id: string } | { club_id: string }[] | null }).teams;
  const team = Array.isArray(rel) ? rel[0] : rel;
  if (!team?.club_id) return null;
  return { date: data.date as string, club_id: team.club_id };
}

// ---------------------------------------------------------------------------
// Indicateurs / tests (physical_metrics) — définis au niveau du club
// ---------------------------------------------------------------------------

export async function createMetricAction({
  playerId,
  locale,
  fields,
}: {
  playerId: string;
  locale: string;
  fields: MetricFields;
}) {
  if (!fields.name.trim()) return { error: "Missing name" };

  const { supabase, user } = await requireUser(locale);
  const player = await playerClub(supabase, playerId);
  if (!player) return { error: "Not found" };

  const { error } = await supabase.from("physical_metrics").insert({
    club_id: player.club_id,
    created_by: user.id,
    ...metricFieldsToRow(fields),
  });

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/contingent/${playerId}`);
  return { ok: true as const };
}

export async function updateMetricAction({
  playerId,
  locale,
  metricId,
  fields,
}: {
  playerId: string;
  locale: string;
  metricId: string;
  fields: MetricFields;
}) {
  if (!fields.name.trim() || !metricId) return { error: "Missing fields" };

  const { supabase } = await requireUser(locale);

  const { error } = await supabase
    .from("physical_metrics")
    .update({ ...metricFieldsToRow(fields), updated_at: new Date().toISOString() })
    .eq("id", metricId);

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/contingent/${playerId}`);
  return { ok: true as const };
}

export async function archiveMetricAction({
  playerId,
  locale,
  metricId,
  archived,
}: {
  playerId: string;
  locale: string;
  metricId: string;
  archived: boolean;
}) {
  if (!metricId) return { error: "Missing fields" };
  const { supabase } = await requireUser(locale);

  const { error } = await supabase
    .from("physical_metrics")
    .update({ archived, updated_at: new Date().toISOString() })
    .eq("id", metricId);

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/contingent/${playerId}`);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Mesures (physical_measurements) — par joueur / test / date
// ---------------------------------------------------------------------------

/**
 * Écrit une mesure (upsert) ou la supprime si vidée. Cible d'unicité :
 * `(player_id, metric_id, measured_on)`.
 */
async function writeMeasurement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    clubId,
    playerId,
    metricId,
    measuredOn,
    sessionId,
    value,
    note,
    userId,
  }: {
    clubId: string;
    playerId: string;
    metricId: string;
    measuredOn: string;
    sessionId: string | null;
    value: number | null;
    note: string | null;
    userId: string;
  },
): Promise<{ error?: string }> {
  const cleanNote = note?.trim() || null;

  // Cellule vidée (ni valeur ni note) → on supprime l'enregistrement.
  if (value === null && !cleanNote) {
    const { error } = await supabase
      .from("physical_measurements")
      .delete()
      .eq("player_id", playerId)
      .eq("metric_id", metricId)
      .eq("measured_on", measuredOn);
    return error ? { error: error.message } : {};
  }

  const { error } = await supabase.from("physical_measurements").upsert(
    {
      club_id: clubId,
      player_id: playerId,
      metric_id: metricId,
      session_id: sessionId,
      measured_on: measuredOn,
      value,
      note: cleanNote,
      recorded_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id,metric_id,measured_on" },
  );
  return error ? { error: error.message } : {};
}

/** Saisie manuelle depuis la fiche joueur (onglet Physique). */
export async function upsertMeasurementAction({
  playerId,
  locale,
  metricId,
  measuredOn,
  value,
  note,
}: {
  playerId: string;
  locale: string;
  metricId: string;
  measuredOn: string;
  value: number | null;
  note: string | null;
}) {
  if (!playerId || !metricId || !measuredOn) return { error: "Missing fields" };

  const { supabase, user } = await requireUser(locale);
  const player = await playerClub(supabase, playerId);
  if (!player) return { error: "Not found" };

  const res = await writeMeasurement(supabase, {
    clubId: player.club_id,
    playerId,
    metricId,
    measuredOn,
    sessionId: null,
    value,
    note,
    userId: user.id,
  });
  if (res.error) return { error: res.error };
  revalidatePath(`/${locale}/contingent/${playerId}`);
  return { ok: true as const };
}

export async function deleteMeasurementAction({
  playerId,
  locale,
  metricId,
  measuredOn,
}: {
  playerId: string;
  locale: string;
  metricId: string;
  measuredOn: string;
}) {
  if (!playerId || !metricId || !measuredOn) return { error: "Missing fields" };
  const { supabase } = await requireUser(locale);

  const { error } = await supabase
    .from("physical_measurements")
    .delete()
    .eq("player_id", playerId)
    .eq("metric_id", metricId)
    .eq("measured_on", measuredOn);

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/contingent/${playerId}`);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Liaison test ↔ séance (session_physical_tests) + saisie depuis la séance
// ---------------------------------------------------------------------------

export async function attachTestToSessionAction({
  locale,
  teamId,
  sessionId,
  metricId,
}: {
  locale: string;
  teamId: string;
  sessionId: string;
  metricId: string;
}) {
  if (!sessionId || !metricId) return { error: "Missing fields" };
  const { supabase, user } = await requireUser(locale);
  const session = await sessionClub(supabase, sessionId);
  if (!session) return { error: "Not found" };

  const { error } = await supabase
    .from("session_physical_tests")
    .upsert(
      { club_id: session.club_id, session_id: sessionId, metric_id: metricId, created_by: user.id },
      { onConflict: "session_id,metric_id", ignoreDuplicates: true },
    );

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}/eval`);
  return { ok: true as const };
}

export async function detachTestFromSessionAction({
  locale,
  teamId,
  sessionId,
  metricId,
}: {
  locale: string;
  teamId: string;
  sessionId: string;
  metricId: string;
}) {
  if (!sessionId || !metricId) return { error: "Missing fields" };
  const { supabase } = await requireUser(locale);

  const { error } = await supabase
    .from("session_physical_tests")
    .delete()
    .eq("session_id", sessionId)
    .eq("metric_id", metricId);

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}/eval`);
  return { ok: true as const };
}

/** Saisie d'un résultat depuis la page éval physique d'une séance. */
export async function recordSessionMeasurementAction({
  locale,
  teamId,
  sessionId,
  playerId,
  metricId,
  value,
}: {
  locale: string;
  teamId: string;
  sessionId: string;
  playerId: string;
  metricId: string;
  value: number | null;
}) {
  if (!sessionId || !playerId || !metricId) return { error: "Missing fields" };
  const { supabase, user } = await requireUser(locale);
  const session = await sessionClub(supabase, sessionId);
  if (!session) return { error: "Not found" };

  const res = await writeMeasurement(supabase, {
    clubId: session.club_id,
    playerId,
    metricId,
    measuredOn: session.date,
    sessionId,
    value,
    note: null,
    userId: user.id,
  });
  if (res.error) return { error: res.error };
  revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}/eval`);
  revalidatePath(`/${locale}/contingent/${playerId}`);
  return { ok: true as const };
}
