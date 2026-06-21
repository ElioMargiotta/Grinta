"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/getUser";
import { isClubWideLevel } from "@/lib/club/types";

/**
 * Gestion club-scoped des tests physiques depuis la page globale « Physique ».
 * Variantes des actions de la fiche joueur (cf.
 * `contingent/[playerId]/physical/actions.ts`) qui résolvent le club via la
 * membership active plutôt que via un `playerId`. Création/édition réservées aux
 * niveaux club-wide (full/extended), comme `canManageMetrics` côté UI.
 */

export async function createClubMetricAction({
  locale,
  name,
  unit,
  category,
  description,
  protocol,
  higherIsBetter,
}: {
  locale: string;
  name: string;
  unit: string | null;
  category: string | null;
  description: string | null;
  protocol: string | null;
  higherIsBetter: boolean;
}) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Missing name" };

  const { supabase, user, membership } = await requireMembership(locale);
  if (!isClubWideLevel(membership.access_level)) return { error: "Forbidden" };

  const { error } = await supabase.from("physical_metrics").insert({
    club_id: membership.club_id,
    created_by: user.id,
    name: trimmed,
    unit: unit?.trim() || null,
    category: category?.trim() || null,
    description: description?.trim() || null,
    protocol: protocol?.trim() || null,
    higher_is_better: higherIsBetter,
  });

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/physique`);
  return { ok: true as const };
}

export async function updateClubMetricAction({
  locale,
  metricId,
  name,
  unit,
  category,
  description,
  protocol,
  higherIsBetter,
}: {
  locale: string;
  metricId: string;
  name: string;
  unit: string | null;
  category: string | null;
  description: string | null;
  protocol: string | null;
  higherIsBetter: boolean;
}) {
  const trimmed = name.trim();
  if (!trimmed || !metricId) return { error: "Missing fields" };

  const { supabase, membership } = await requireMembership(locale);
  if (!isClubWideLevel(membership.access_level)) return { error: "Forbidden" };

  const { error } = await supabase
    .from("physical_metrics")
    .update({
      name: trimmed,
      unit: unit?.trim() || null,
      category: category?.trim() || null,
      description: description?.trim() || null,
      protocol: protocol?.trim() || null,
      higher_is_better: higherIsBetter,
      updated_at: new Date().toISOString(),
    })
    .eq("id", metricId)
    .eq("club_id", membership.club_id);

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/physique`);
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
  revalidatePath(`/${locale}/physique`);
  return { ok: true as const };
}
