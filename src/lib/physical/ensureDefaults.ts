import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_METRIC_LIBRARY,
  higherIsBetterFromInterpretation,
} from "@/lib/physical/defaultLibrary";

/**
 * Provisionne (idempotent) la bibliothèque par défaut pour un club : tous les
 * indicateurs par défaut sont visibles d'office. On n'insère que ceux qui n'ont
 * pas encore de ligne (`default_key`) — un indicateur retiré (archivé) garde sa
 * ligne et n'est donc pas réinséré. Appelé au chargement de la page Évaluation.
 */
export async function ensureDefaultMetrics(
  supabase: SupabaseClient,
  clubId: string,
  userId: string,
): Promise<void> {
  const { data: existingRows } = await supabase
    .from("physical_metrics")
    .select("default_key")
    .eq("club_id", clubId)
    .not("default_key", "is", null);

  const existing = new Set(
    (existingRows ?? []).map((r) => r.default_key as string),
  );

  const missing = DEFAULT_METRIC_LIBRARY.filter((d) => !existing.has(d.key));
  if (missing.length === 0) return;

  await supabase.from("physical_metrics").insert(
    missing.map((d, i) => ({
      club_id: clubId,
      created_by: userId,
      name: d.name,
      unit: d.unit,
      category: d.category,
      subcategory: d.subcategory,
      value_type: d.valueType,
      interpretation: d.interpretation,
      higher_is_better: higherIsBetterFromInterpretation(d.interpretation),
      description: d.description,
      protocol: d.protocol,
      material: d.material,
      trials: d.trials,
      validity_conditions: d.validityConditions,
      recommended_frequency: d.recommendedFrequency,
      display: d.display,
      alert_threshold: d.alertThreshold ?? null,
      default_key: d.key,
      sort_order: i,
    })),
  );
}
