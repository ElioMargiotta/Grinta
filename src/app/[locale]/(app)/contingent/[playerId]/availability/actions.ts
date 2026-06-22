"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  UNAVAILABILITY_KINDS,
  type UnavailabilityKind,
} from "@/lib/availability/unavailability";

/**
 * Indisponibilités joueur (blessure / maladie / suspension / autre).
 * Écritures rattachées au club du joueur. La RLS borne déjà l'accès staff ;
 * on résout le club via le joueur pour renseigner `club_id`.
 */

async function requireUser(locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  return { supabase, user };
}

async function playerClub(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerId: string,
) {
  const { data } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("id", playerId)
    .single();
  return data ?? null;
}

function normalizeKind(kind: string): UnavailabilityKind | null {
  return (UNAVAILABILITY_KINDS as string[]).includes(kind)
    ? (kind as UnavailabilityKind)
    : null;
}

function validateDates(startDate: string, endDate: string | null): string | null {
  if (!startDate) return "Missing start date";
  if (endDate && endDate < startDate) return "End date before start date";
  return null;
}

export async function createUnavailabilityAction({
  playerId,
  locale,
  kind,
  reason,
  startDate,
  endDate,
}: {
  playerId: string;
  locale: string;
  kind: string;
  reason: string | null;
  startDate: string;
  endDate: string | null;
}) {
  const k = normalizeKind(kind);
  if (!k) return { error: "Invalid kind" };
  const dateError = validateDates(startDate, endDate);
  if (dateError) return { error: dateError };

  const { supabase, user } = await requireUser(locale);
  const player = await playerClub(supabase, playerId);
  if (!player) return { error: "Not found" };

  const { error } = await supabase.from("player_unavailability").insert({
    club_id: player.club_id,
    player_id: playerId,
    kind: k,
    reason: reason?.trim() || null,
    start_date: startDate,
    end_date: endDate || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/contingent/${playerId}`);
  revalidatePath(`/${locale}/contingent`);
  return { ok: true as const };
}

export async function updateUnavailabilityAction({
  playerId,
  locale,
  id,
  kind,
  reason,
  startDate,
  endDate,
}: {
  playerId: string;
  locale: string;
  id: string;
  kind: string;
  reason: string | null;
  startDate: string;
  endDate: string | null;
}) {
  if (!id) return { error: "Missing fields" };
  const k = normalizeKind(kind);
  if (!k) return { error: "Invalid kind" };
  const dateError = validateDates(startDate, endDate);
  if (dateError) return { error: dateError };

  const { supabase } = await requireUser(locale);

  const { error } = await supabase
    .from("player_unavailability")
    .update({
      kind: k,
      reason: reason?.trim() || null,
      start_date: startDate,
      end_date: endDate || null,
    })
    .eq("id", id)
    .eq("player_id", playerId);

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/contingent/${playerId}`);
  revalidatePath(`/${locale}/contingent`);
  return { ok: true as const };
}

export async function deleteUnavailabilityAction({
  playerId,
  locale,
  id,
}: {
  playerId: string;
  locale: string;
  id: string;
}) {
  if (!id) return { error: "Missing fields" };
  const { supabase } = await requireUser(locale);

  const { error } = await supabase
    .from("player_unavailability")
    .delete()
    .eq("id", id)
    .eq("player_id", playerId);

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/contingent/${playerId}`);
  revalidatePath(`/${locale}/contingent`);
  return { ok: true as const };
}

/**
 * Déclaration rapide d'indisponibilité depuis la grille éval d'une séance :
 * crée une période ouverte (end_date NULL) démarrant à la date de l'éval.
 */
export async function declareUnavailabilityFromSessionAction({
  locale,
  teamId,
  sessionId,
  playerId,
  kind,
  startDate,
}: {
  locale: string;
  teamId: string;
  sessionId: string;
  playerId: string;
  kind: string;
  startDate: string;
}) {
  const k = normalizeKind(kind);
  if (!k) return { error: "Invalid kind" };
  if (!startDate) return { error: "Missing start date" };

  const { supabase, user } = await requireUser(locale);
  const player = await playerClub(supabase, playerId);
  if (!player) return { error: "Not found" };

  const { error } = await supabase.from("player_unavailability").insert({
    club_id: player.club_id,
    player_id: playerId,
    kind: k,
    reason: null,
    start_date: startDate,
    end_date: null,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}/test`);
  revalidatePath(`/${locale}/contingent/${playerId}`);
  return { ok: true as const };
}
