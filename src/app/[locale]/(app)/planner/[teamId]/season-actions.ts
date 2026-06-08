"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  planSeason,
  type AnchorMatch,
  type MatchKind,
  type MdScheme,
  type PhaseKind,
  type SeasonStructure,
  type TrainingSlot,
} from "@/lib/planner/season";

type ActionResult = {
  ok?: true;
  error?:
    | "unauthenticated"
    | "team_not_found"
    | "forbidden"
    | "no_anchor_matches"
    | "db_error";
  microcycles?: number;
  sessions?: number;
};

const DEFAULT_WEEKDAYS = [2, 4];
const DEFAULT_SCHEME: MdScheme = "standard";

// Couleurs par défaut des phases (héritées de l'ancien wizard).
const PHASE_COLOR: Record<PhaseKind, string> = {
  preparation: "#0ea5e9",
  competition: "#dc2626",
  transition: "#f59e0b",
};

// Noms de phase localisés (le générateur tourne côté serveur ; petit mapping
// plutôt que de tirer next-intl).
const PHASE_NAME: Record<string, Record<PhaseKind, string>> = {
  fr: { preparation: "Préparation", competition: "Compétition", transition: "Transition" },
  en: { preparation: "Preparation", competition: "Competition", transition: "Transition" },
  de: { preparation: "Vorbereitung", competition: "Wettkampf", transition: "Übergang" },
  it: { preparation: "Preparazione", competition: "Competizione", transition: "Transizione" },
};
const CYCLE_LABEL: Record<string, string> = { fr: "Cycle", en: "Cycle", de: "Zyklus", it: "Ciclo" };

// Couleur d'un mésocycle de compétition selon son thème (sinon palette tournante).
const THEME_COLOR: Record<string, string> = {
  possede_ballon: "#10b981",
  ne_possede_pas: "#f43f5e",
  recupere: "#0ea5e9",
  perd: "#f59e0b",
  recupere_perd: "#8b5cf6",
  decharge: "#94a3b8",
  jeux_polysport: "#14b8a6",
};
const CYCLE_PALETTE = ["#dc2626", "#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];

function parseTrainingSlots(raw: string | null): TrainingSlot[] | undefined {
  if (!raw) return undefined;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return undefined;
    const slots = arr
      .map((s: { weekday?: unknown; time?: unknown; durationMinutes?: unknown }) => ({
        weekday: Number(s.weekday),
        time: typeof s.time === "string" ? s.time : "19:00",
        durationMinutes: Number(s.durationMinutes) || 90,
      }))
      .filter((s) => Number.isInteger(s.weekday) && s.weekday >= 1 && s.weekday <= 7);
    return slots.length ? slots : undefined;
  } catch {
    return undefined;
  }
}

function parseMode(raw: string | null): "replace" | "merge" {
  return raw === "merge" ? "merge" : "replace";
}

function parseSegment(raw: string | null): "first_round" | "second_round" | "full" {
  return raw === "first_round" || raw === "second_round" ? raw : "full";
}

function parseStructure(raw: string | null): SeasonStructure | undefined {
  if (!raw) return undefined;
  try {
    const obj = JSON.parse(raw);
    if (typeof obj?.prepWeeks !== "number" || !Array.isArray(obj?.mesos)) return undefined;
    return {
      prepWeeks: Math.max(0, Math.round(obj.prepWeeks)),
      prepTheme: typeof obj.prepTheme === "string" && obj.prepTheme ? obj.prepTheme : null,
      mesos: obj.mesos
        .map((m: { weeks?: unknown; theme?: unknown; name?: unknown }) => ({
          weeks: Math.max(1, Math.round(Number(m?.weeks) || 1)),
          theme: typeof m?.theme === "string" && m.theme ? m.theme : null,
          name: typeof m?.name === "string" && m.name.trim() ? m.name.trim() : null,
        }))
        .filter((m: { weeks: number }) => m.weeks > 0),
    };
  } catch {
    return undefined;
  }
}

async function loadTeamAccess(teamId: string): Promise<
  | {
      ok: true;
      clubId: string;
      userId: string;
      supabase: Awaited<ReturnType<typeof createClient>>;
    }
  | { ok: false; error: ActionResult["error"] }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: team } = await supabase
    .from("teams")
    .select("id, club_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { ok: false, error: "team_not_found" };

  return { ok: true, clubId: team.club_id as string, userId: user.id, supabase };
}

/**
 * (Re)génère le squelette de saison d'une équipe à partir de ses matchs ancres.
 * Écrit dans macro/méso/micro (modèle lu par la vue Hebdo) :
 *   - 1 macrocycle source='generated' (la saison),
 *   - 1 mésocycle par phase (Préparation / Compétition…),
 *   - 1 microcycle par semaine (aligné lundi), portant à la fois `mesocycle_id`
 *     (→ vue Hebdo + thèmes) et `target_match_id` (→ vue Saison + MD-).
 *
 * Idempotent : on supprime le macrocycle généré précédent (cascade méso+micro) et
 * les sessions 'generated', puis on recrée. Les **thèmes** posés à la main sur les
 * microcycles sont préservés (réappliqués par date de début de semaine), et les
 * **noms de phase** renommés sont réutilisés.
 */
export async function generateSeasonSkeletonAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  const seasonStart = String(formData.get("seasonStart") ?? "").trim() || undefined;
  const seasonEnd = String(formData.get("seasonEnd") ?? "").trim() || undefined;
  const structure = parseStructure(String(formData.get("structure") ?? "") || null);
  const trainingSlots = parseTrainingSlots(String(formData.get("trainingSlots") ?? "") || null);
  const mode = parseMode(String(formData.get("mode") ?? "") || null);
  const segment = parseSegment(String(formData.get("segment") ?? "") || null);
  const seasonLabel =
    String(formData.get("seasonLabel") ?? "").trim() ||
    `${new Date().getFullYear()}/${String((new Date().getFullYear() + 1) % 100).padStart(2, "0")}`;
  const planName = String(formData.get("planName") ?? "").trim();
  const names = PHASE_NAME[locale] ?? PHASE_NAME.fr;
  const cycleLabel = CYCLE_LABEL[locale] ?? CYCLE_LABEL.fr;

  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };
  const { supabase, userId } = access;

  // 1. Réglages de rythme (scopés à la saison du plan).
  const { data: settingsRow } = await supabase
    .from("team_periodization_settings")
    .select("training_weekdays, md_scheme")
    .eq("team_id", teamId)
    .eq("season", seasonLabel)
    .maybeSingle();
  const settings = {
    trainingWeekdays:
      (settingsRow?.training_weekdays as number[] | null) ?? DEFAULT_WEEKDAYS,
    mdScheme: (settingsRow?.md_scheme as MdScheme | null) ?? DEFAULT_SCHEME,
  };

  // 2. Matchs ancres.
  const { data: matchRows, error: matchErr } = await supabase
    .from("team_matches")
    .select("id, starts_at, kind, is_anchor")
    .eq("team_id", teamId)
    .eq("is_anchor", true)
    .eq("archived", false)
    .gte("starts_at", seasonStart ? `${seasonStart}T00:00:00.000Z` : "0001-01-01T00:00:00.000Z")
    .lte("starts_at", seasonEnd ? `${seasonEnd}T23:59:59.999Z` : "9999-12-31T23:59:59.999Z")
    .order("starts_at", { ascending: true });
  if (matchErr) return { error: "db_error" };
  if (!matchRows || matchRows.length === 0) return { error: "no_anchor_matches" };

  const matches: AnchorMatch[] = matchRows.map((m) => ({
    id: m.id as string,
    startsAt: new Date(m.starts_at as string),
    isAnchor: true,
    kind: (m.kind as MatchKind | null) ?? "league",
  }));

  // 3. Plan pur.
  const plan = planSeason(matches, settings, { seasonStart, seasonEnd, structure, trainingSlots });
  if (!plan.macro) return { error: "no_anchor_matches" };

  // 4. Snapshot des formats/notes existants (par date de début de semaine) pour
  //    les préserver à la régénération. Le THÈME, lui, est piloté par le wizard
  //    (structure) : la phase impose son thème par défaut.
  const { data: existingMicros } = await supabase
    .from("microcycles")
    .select("start_date, theme, format, notes")
    .eq("team_id", teamId);
  const themeByDate = new Map<
    string,
    { theme: string | null; format: string | null; notes: string | null }
  >();
  for (const mi of existingMicros ?? []) {
    themeByDate.set(mi.start_date as string, {
      theme: (mi.theme as string | null) ?? null,
      format: (mi.format as string | null) ?? null,
      notes: (mi.notes as string | null) ?? null,
    });
  }

  // 5. Plan saison/tour : cadre imposé pour pouvoir retrouver les semaines par
  //    saison sportive et par tour.
  const { data: seasonPlan, error: seasonPlanErr } = await supabase
    .from("season_plans")
    .upsert(
      {
        team_id: teamId,
        club_id: access.clubId,
        season_label: seasonLabel,
        segment,
        mode,
        name: planName || null,
        start_date: plan.macro.preseasonStart,
        championship_start_date: plan.macro.firstMatch,
        end_date: plan.macro.end,
        status: "generated",
        source: "generated",
      },
      { onConflict: "team_id,season_label,segment" },
    )
    .select("id")
    .single();
  if (seasonPlanErr || !seasonPlan) return { error: "db_error" };

  // 5b. Auto-archivage : en planifiant un nouveau millésime, les saisons
  //     ANTÉRIEURES (libellé `YYYY/YY` < courant) passent en « archivé ». Elles
  //     restent consultables via le sélecteur mais sortent de la saison active.
  await supabase
    .from("season_plans")
    .update({ status: "archived" })
    .eq("team_id", teamId)
    .lt("season_label", seasonLabel)
    .neq("status", "archived");

  // 6. Purge des artefacts générés. En mode merge, on ne purge que les dates du
  //    tour choisi ; en replace, on remplace le plan saison/tour ciblé.
  if (mode === "merge") {
    const { data: microsForPlan } = await supabase
      .from("microcycles")
      .select("id")
      .eq("team_id", teamId)
      .eq("season_plan_id", seasonPlan.id)
      .gte("start_date", plan.macro.preseasonStart)
      .lte("start_date", plan.macro.end);
    const microIds = (microsForPlan ?? []).map((m) => m.id as string);
    if (microIds.length > 0) {
      await supabase
        .from("sessions")
        .delete()
        .eq("team_id", teamId)
        .eq("source", "generated")
        .in("microcycle_id", microIds);
      await supabase
        .from("microcycles")
        .delete()
        .eq("team_id", teamId)
        .in("id", microIds);
    }
    await supabase
      .from("mesocycles")
      .delete()
      .eq("season_plan_id", seasonPlan.id);
    await supabase
      .from("sessions")
      .delete()
      .eq("team_id", teamId)
      .eq("source", "generated")
      .gte("date", plan.macro.preseasonStart)
      .lte("date", plan.macro.end);
    await supabase
      .from("microcycles")
      .delete()
      .eq("team_id", teamId)
      .is("season_plan_id", null)
      .not("target_match_id", "is", null)
      .gte("start_date", plan.macro.preseasonStart)
      .lte("start_date", plan.macro.end);
  } else {
    const { data: microsForPlan } = await supabase
      .from("microcycles")
      .select("id")
      .eq("team_id", teamId)
      .eq("season_plan_id", seasonPlan.id);
    const microIds = (microsForPlan ?? []).map((m) => m.id as string);
    if (microIds.length > 0) {
      await supabase
        .from("sessions")
        .delete()
        .eq("team_id", teamId)
        .eq("source", "generated")
        .in("microcycle_id", microIds);
      await supabase
        .from("microcycles")
        .delete()
        .eq("team_id", teamId)
        .in("id", microIds);
    }
    await supabase
      .from("mesocycles")
      .delete()
      .eq("season_plan_id", seasonPlan.id);
    await supabase
      .from("sessions")
      .delete()
      .eq("team_id", teamId)
      .eq("source", "generated")
      .gte("date", plan.macro.preseasonStart)
      .lte("date", plan.macro.end);
    await supabase
      .from("microcycles")
      .delete()
      .eq("team_id", teamId)
      .is("season_plan_id", null)
      .not("target_match_id", "is", null)
      .gte("start_date", plan.macro.preseasonStart)
      .lte("start_date", plan.macro.end);
  }

  // 7. Macrocycle. En merge, on réutilise le macro généré s'il existe, pour
  //    permettre de planifier 1er puis 2e tour dans le même conteneur.
  const { data: existingGenerated } = await supabase
    .from("macrocycles")
    .select("id, preseason_start_date, first_match_date, end_date")
    .eq("team_id", teamId)
    .eq("source", "generated")
    .maybeSingle();

  let macro: { id: string };
  if (existingGenerated?.id) {
    const preseasonStart =
      !existingGenerated.preseason_start_date ||
      existingGenerated.preseason_start_date > plan.macro.preseasonStart
        ? plan.macro.preseasonStart
        : existingGenerated.preseason_start_date;
    const firstMatch =
      !existingGenerated.first_match_date ||
      existingGenerated.first_match_date > plan.macro.firstMatch
        ? plan.macro.firstMatch
        : existingGenerated.first_match_date;
    const endDate =
      !existingGenerated.end_date || existingGenerated.end_date < plan.macro.end
        ? plan.macro.end
        : existingGenerated.end_date;
    const { error: updateMacroErr } = await supabase
      .from("macrocycles")
      .update({
        name: planName || plan.macro.firstMatch.slice(0, 4),
        season_plan_id: seasonPlan.id,
        preseason_start_date: preseasonStart,
        first_match_date: firstMatch,
        end_date: endDate,
      })
      .eq("id", existingGenerated.id);
    if (updateMacroErr) return { error: "db_error" };
    macro = { id: existingGenerated.id as string };
  } else {
    const { count: macroCount } = await supabase
      .from("macrocycles")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId);
    const { data: insertedMacro, error: macroErr } = await supabase
      .from("macrocycles")
      .insert({
        team_id: teamId,
        trainer_id: userId,
        name: planName || plan.macro.firstMatch.slice(0, 4),
        order_index: macroCount ?? 0,
        source: "generated",
        season_plan_id: seasonPlan.id,
        preseason_start_date: plan.macro.preseasonStart,
        first_match_date: plan.macro.firstMatch,
        end_date: plan.macro.end,
      })
      .select("id")
      .single();
    if (macroErr || !insertedMacro) return { error: "db_error" };
    macro = { id: insertedMacro.id as string };
  }

  // 7. Mésocycles (phases). Un mésocycle de compétition = un « Cycle N » nommé,
  //    coloré selon son thème (sinon palette tournante).
  let cycleN = 0;
  const mesoRows = plan.phases.map((ph, i) => {
    let name: string;
    let color: string;
    if (ph.kind === "preparation") {
      name = ph.name ?? names.preparation;
      color = PHASE_COLOR.preparation;
    } else if (ph.kind === "transition") {
      name = ph.name ?? names.transition;
      color = PHASE_COLOR.transition;
    } else {
      cycleN++;
      name = ph.name ?? (structure ? `${cycleLabel} ${cycleN}` : names.competition);
      color =
        (ph.theme && THEME_COLOR[ph.theme]) ??
        CYCLE_PALETTE[(cycleN - 1) % CYCLE_PALETTE.length];
    }
    return {
      macrocycle_id: macro.id,
      season_plan_id: seasonPlan.id,
      trainer_id: userId,
      name,
      kind: ph.kind,
      order_index: i,
      color,
    };
  });
  const { data: insertedMesos, error: mesoErr } = await supabase
    .from("mesocycles")
    .insert(mesoRows)
    .select("id, order_index");
  if (mesoErr || !insertedMesos) return { error: "db_error" };
  const mesoByIndex = new Map<number, string>();
  for (const me of insertedMesos) {
    mesoByIndex.set(me.order_index as number, me.id as string);
  }

  // 8. Microcycles (1 par semaine). Thème par défaut = thème de la phase (wizard) ;
  //    sinon on réutilise le thème déjà posé. Format/notes toujours préservés.
  const microRows = plan.microcycles.map((mc) => {
    const carried = themeByDate.get(mc.startDate);
    const phaseTheme = plan.phases[mc.phaseIndex]?.theme ?? null;
    return {
      mesocycle_id: mesoByIndex.get(mc.phaseIndex) ?? null,
      season_plan_id: seasonPlan.id,
      team_id: teamId,
      trainer_id: userId,
      target_match_id: mc.targetMatchId,
      kind: mc.phase,
      start_date: mc.startDate,
      week_number: mc.weekNumber,
      theme: phaseTheme ?? carried?.theme ?? null,
      format: carried?.format ?? null,
      notes: carried?.notes ?? null,
    };
  });
  const { data: insertedMicros, error: microErr } = await supabase
    .from("microcycles")
    .insert(microRows)
    .select("id, start_date, target_match_id");
  if (microErr || !insertedMicros) return { error: "db_error" };

  const microByDate = new Map<string, string>();
  const microByMatch = new Map<string, string>();
  for (const mi of insertedMicros) {
    microByDate.set(mi.start_date as string, mi.id as string);
    if (mi.target_match_id) microByMatch.set(mi.target_match_id as string, mi.id as string);
  }

  // 9. Lien retour matchs → microcycle.
  for (const [matchId, microId] of microByMatch) {
    const { error } = await supabase
      .from("team_matches")
      .update({ microcycle_id: microId })
      .eq("id", matchId);
    if (error) return { error: "db_error" };
  }

  // 10. Sessions générées.
  const sessionRows = plan.microcycles.flatMap((mc) => {
    const microId = microByDate.get(mc.startDate);
    if (!microId) return [];
    return mc.sessions.map((s) => ({
      team_id: teamId,
      trainer_id: userId,
      microcycle_id: microId,
      date: s.date,
      start_time: s.startTime,
      duration_minutes: s.durationMinutes,
      md_offset: s.mdOffset,
      source: "generated" as const,
    }));
  });
  if (sessionRows.length > 0) {
    const { error: sessErr } = await supabase.from("sessions").insert(sessionRows);
    if (sessErr) return { error: "db_error" };
  }

  revalidatePath(`/${locale}/planner/${teamId}`);
  return {
    ok: true,
    microcycles: insertedMicros.length,
    sessions: sessionRows.length,
  };
}
