"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { EvaluationData } from "@/components/evaluation/types";

export async function createPlayerEvaluationAction({
  playerId,
  locale,
}: {
  playerId: string;
  locale: string;
}) {
  if (!playerId) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, club_id")
    .eq("id", playerId)
    .single();
  if (playerError || !player) return { error: "Not found" };

  const { data: inserted, error } = await supabase
    .from("player_evaluations")
    .insert({
      player_id: player.id,
      club_id: player.club_id,
      created_by: user.id,
      data: {},
    })
    .select("id")
    .single();

  if (error || !inserted) return { error: error?.message ?? "Insert failed" };

  revalidatePath(`/${locale}/contingent/${playerId}`);
  redirect(`/${locale}/contingent/${playerId}/evaluations/${inserted.id}`);
}

export async function savePlayerEvaluationAction({
  playerId,
  evaluationId,
  locale,
  data,
}: {
  playerId: string;
  evaluationId: string;
  locale: string;
  data: EvaluationData;
}) {
  if (!playerId || !evaluationId) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase
    .from("player_evaluations")
    .update({
      data,
      season: data.season || null,
      evaluation_date: data.evaluationDate || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", evaluationId)
    .eq("player_id", playerId);

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/contingent/${playerId}`);
  revalidatePath(`/${locale}/contingent/${playerId}/evaluations/${evaluationId}`);
}

export async function setEvaluationSharedAction({
  playerId,
  evaluationId,
  locale,
  shared,
}: {
  playerId: string;
  evaluationId: string;
  locale: string;
  shared: boolean;
}) {
  if (!playerId || !evaluationId) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase
    .from("player_evaluations")
    .update({ shared_with_player: shared })
    .eq("id", evaluationId)
    .eq("player_id", playerId);

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/contingent/${playerId}`);
  revalidatePath(`/${locale}/contingent/${playerId}/evaluations/${evaluationId}`);
  return { ok: true as const };
}

export async function deletePlayerEvaluationAction({
  playerId,
  evaluationId,
  locale,
}: {
  playerId: string;
  evaluationId: string;
  locale: string;
}) {
  if (!playerId || !evaluationId) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase
    .from("player_evaluations")
    .delete()
    .eq("id", evaluationId)
    .eq("player_id", playerId);

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/contingent/${playerId}`);
  redirect(`/${locale}/contingent/${playerId}`);
}
