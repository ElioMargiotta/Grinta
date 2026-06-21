"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/getUser";
import { isClubWideLevel } from "@/lib/club/types";
import { type MetricFields, metricFieldsToRow } from "@/lib/physical/defaultLibrary";

/**
 * Gestion club-scoped des indicateurs depuis la page Évaluation. Variantes des
 * actions de la fiche joueur (cf. `contingent/[playerId]/physical/actions.ts`)
 * qui résolvent le club via la membership active plutôt que via un `playerId`.
 * Création/édition réservées aux niveaux club-wide (full/extended).
 */

export async function createClubMetricAction({
  locale,
  fields,
}: {
  locale: string;
  fields: MetricFields;
}) {
  if (!fields.name.trim()) return { error: "Missing name" };

  const { supabase, user, membership } = await requireMembership(locale);
  if (!isClubWideLevel(membership.access_level)) return { error: "Forbidden" };

  const { error } = await supabase.from("physical_metrics").insert({
    club_id: membership.club_id,
    created_by: user.id,
    ...metricFieldsToRow(fields),
  });

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/evaluation`);
  return { ok: true as const };
}

export async function updateClubMetricAction({
  locale,
  metricId,
  fields,
}: {
  locale: string;
  metricId: string;
  fields: MetricFields;
}) {
  if (!fields.name.trim() || !metricId) return { error: "Missing fields" };

  const { supabase, membership } = await requireMembership(locale);
  if (!isClubWideLevel(membership.access_level)) return { error: "Forbidden" };

  const { error } = await supabase
    .from("physical_metrics")
    .update({ ...metricFieldsToRow(fields), updated_at: new Date().toISOString() })
    .eq("id", metricId)
    .eq("club_id", membership.club_id);

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/evaluation`);
  return { ok: true as const };
}

export async function archiveClubMetricAction({
  locale,
  metricId,
  archived,
}: {
  locale: string;
  metricId: string;
  archived: boolean;
}) {
  if (!metricId) return { error: "Missing fields" };

  const { supabase, membership } = await requireMembership(locale);
  if (!isClubWideLevel(membership.access_level)) return { error: "Forbidden" };

  const { error } = await supabase
    .from("physical_metrics")
    .update({ archived, updated_at: new Date().toISOString() })
    .eq("id", metricId)
    .eq("club_id", membership.club_id);

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/evaluation`);
  return { ok: true as const };
}

/**
 * Suppression définitive d'un indicateur personnalisé. Réservée aux indicateurs
 * propres au club (`default_key IS NULL`) : la bibliothèque par défaut reste
 * archivable/réactivable. La FK `physical_measurements.metric_id` étant en
 * ON DELETE CASCADE, les mesures associées sont supprimées avec l'indicateur.
 */
export async function deleteClubMetricAction({
  locale,
  metricId,
}: {
  locale: string;
  metricId: string;
}) {
  if (!metricId) return { error: "Missing fields" };

  const { supabase, membership } = await requireMembership(locale);
  if (!isClubWideLevel(membership.access_level)) return { error: "Forbidden" };

  const { error } = await supabase
    .from("physical_metrics")
    .delete()
    .eq("id", metricId)
    .eq("club_id", membership.club_id)
    .is("default_key", null);

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/evaluation`);
  return { ok: true as const };
}

/**
 * Suppression d'une éval physique (session `kind = 'physical_eval'`). Retire
 * l'instance du planning et ses tests rattachés (FK ON DELETE CASCADE) ; les
 * résultats déjà saisis sont conservés (FK measurements.session_id en SET NULL).
 */
export async function deletePhysicalEvalAction({
  locale,
  sessionId,
}: {
  locale: string;
  sessionId: string;
}) {
  if (!sessionId) return { error: "Missing fields" };

  const { supabase, membership } = await requireMembership(locale);
  if (!isClubWideLevel(membership.access_level)) return { error: "Forbidden" };

  // On vérifie que l'éval appartient bien au club de la membership active.
  const { data: evalSession } = await supabase
    .from("sessions")
    .select("id, teams!inner(club_id)")
    .eq("id", sessionId)
    .eq("kind", "physical_eval")
    .eq("teams.club_id", membership.club_id)
    .maybeSingle();
  if (!evalSession) return { error: "Not found" };

  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/evaluation`);
  return { ok: true as const };
}
