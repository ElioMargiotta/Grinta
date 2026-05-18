"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type MesocycleInput = {
  name: string;
  kind: "preparation" | "competition" | "transition" | "custom";
  weekCount: number;
  color?: string | null;
};

function mondayOf(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt;
}

function addDaysUTC(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function ymdUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function diffWeeks(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 86_400_000));
}

export async function createMacrocycleAction(formData: FormData) {
  const teamId = String(formData.get("teamId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const preseasonStart = String(formData.get("preseasonStart") ?? "");
  const firstMatch = String(formData.get("firstMatch") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  let mesocycles: MesocycleInput[] = [];
  try {
    mesocycles = JSON.parse(String(formData.get("mesocycles") ?? "[]"));
  } catch {
    return { error: "Invalid mesocycles payload" };
  }

  if (!teamId || !name || !preseasonStart || !firstMatch || !endDate) {
    return { error: "Missing fields" };
  }
  if (!Array.isArray(mesocycles) || mesocycles.length === 0) {
    return { error: "At least one mesocycle is required" };
  }

  const preseasonMon = mondayOf(preseasonStart);
  const firstMatchMon = mondayOf(firstMatch);
  const endMon = mondayOf(endDate);
  const totalWeeks = diffWeeks(preseasonMon, endMon) + 1;
  if (totalWeeks <= 0) return { error: "End date must be after preseason start" };

  const sumWeeks = mesocycles.reduce((s, m) => s + (m.weekCount || 0), 0);
  if (sumWeeks !== totalWeeks) {
    return {
      error: `Mésocycle weeks (${sumWeeks}) must equal total weeks (${totalWeeks})`,
    };
  }

  const firstMatchIdx = diffWeeks(preseasonMon, firstMatchMon);
  if (firstMatchIdx < 0 || firstMatchIdx >= totalWeeks) {
    return { error: "First match date must fall between preseason start and end" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { count: existingCount } = await supabase
    .from("macrocycles")
    .select("*", { count: "exact", head: true })
    .eq("team_id", teamId);

  const { data: macro, error: macroErr } = await supabase
    .from("macrocycles")
    .insert({
      team_id: teamId,
      trainer_id: user.id,
      name,
      order_index: existingCount ?? 0,
      preseason_start_date: ymdUTC(preseasonMon),
      first_match_date: ymdUTC(firstMatchMon),
      end_date: ymdUTC(addDaysUTC(endMon, 6)),
    })
    .select("id")
    .single();
  if (macroErr || !macro) return { error: macroErr?.message ?? "Insert failed" };

  const mesoRows = mesocycles.map((m, i) => ({
    macrocycle_id: macro.id,
    trainer_id: user.id,
    name: m.name.trim() || `Mésocycle ${i + 1}`,
    kind: m.kind,
    order_index: i,
    color: m.color ?? null,
  }));
  const { data: insertedMesos, error: mesoErr } = await supabase
    .from("mesocycles")
    .insert(mesoRows)
    .select("id");
  if (mesoErr || !insertedMesos) return { error: mesoErr?.message ?? "Mesocycle insert failed" };

  const microRows: {
    mesocycle_id: string;
    trainer_id: string;
    start_date: string;
    week_number: number;
  }[] = [];
  let microIdx = 0;
  for (let i = 0; i < mesocycles.length; i++) {
    const mesoId = insertedMesos[i].id;
    for (let w = 0; w < mesocycles[i].weekCount; w++) {
      const startDate = ymdUTC(addDaysUTC(preseasonMon, microIdx * 7));
      const weekNum =
        microIdx < firstMatchIdx ? microIdx - firstMatchIdx : microIdx - firstMatchIdx + 1;
      microRows.push({
        mesocycle_id: mesoId,
        trainer_id: user.id,
        start_date: startDate,
        week_number: weekNum,
      });
      microIdx++;
    }
  }
  const { error: microErr } = await supabase.from("microcycles").insert(microRows);
  if (microErr) return { error: microErr.message };

  revalidatePath(`/${locale}/planner/${teamId}`);
  return { ok: true };
}

export async function updateMicrocycleAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  const themeRaw = String(formData.get("theme") ?? "").trim();
  const formatRaw = String(formData.get("format") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  if (!id) return { error: "Missing id" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("microcycles")
    .update({
      theme: themeRaw || null,
      format: formatRaw || null,
      notes: notesRaw || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${teamId}`);
  return { ok: true };
}

type MesocyclePatch = {
  id: string;
  name: string;
  kind: "preparation" | "competition" | "transition" | "custom";
  color?: string | null;
};

export async function updateMacrocycleAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  const name = String(formData.get("name") ?? "").trim();
  const preseasonStart = String(formData.get("preseasonStart") ?? "");
  const firstMatch = String(formData.get("firstMatch") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  if (!id || !teamId || !name || !preseasonStart || !firstMatch || !endDate) {
    return { error: "Missing fields" };
  }

  let mesoPatches: MesocyclePatch[] = [];
  try {
    mesoPatches = JSON.parse(String(formData.get("mesocycles") ?? "[]"));
  } catch {
    return { error: "Invalid mesocycles payload" };
  }

  const newPreseasonMon = mondayOf(preseasonStart);
  const newFirstMatchMon = mondayOf(firstMatch);
  const newEndMon = mondayOf(endDate);
  const newTotalWeeks = diffWeeks(newPreseasonMon, newEndMon) + 1;
  if (newTotalWeeks <= 0) return { error: "End date must be after preseason start" };
  const newFirstMatchIdx = diffWeeks(newPreseasonMon, newFirstMatchMon);
  if (newFirstMatchIdx < 0 || newFirstMatchIdx >= newTotalWeeks) {
    return { error: "First match date must fall between preseason start and end" };
  }

  const supabase = await createClient();

  // Load current microcycles ordered by date so we can re-anchor them in place.
  const { data: existingMesos, error: mesoFetchErr } = await supabase
    .from("mesocycles")
    .select("id")
    .eq("macrocycle_id", id);
  if (mesoFetchErr || !existingMesos) {
    return { error: mesoFetchErr?.message ?? "Failed to load mesocycles" };
  }
  const existingMesoIds = existingMesos.map((m) => m.id);

  const { data: existingMicros, error: microFetchErr } = existingMesoIds.length
    ? await supabase
        .from("microcycles")
        .select("id, start_date")
        .in("mesocycle_id", existingMesoIds)
        .order("start_date", { ascending: true })
    : { data: [], error: null };
  if (microFetchErr) return { error: microFetchErr.message };

  if ((existingMicros?.length ?? 0) !== newTotalWeeks) {
    return {
      error: `Cannot change total weeks (have ${existingMicros?.length ?? 0}, new range = ${newTotalWeeks}). Add or remove mesocycles via Cycle view.`,
    };
  }

  const { error: macroErr } = await supabase
    .from("macrocycles")
    .update({
      name,
      preseason_start_date: ymdUTC(newPreseasonMon),
      first_match_date: ymdUTC(newFirstMatchMon),
      end_date: ymdUTC(addDaysUTC(newEndMon, 6)),
    })
    .eq("id", id);
  if (macroErr) return { error: macroErr.message };

  for (const patch of mesoPatches) {
    if (!patch.id) continue;
    const { error: e } = await supabase
      .from("mesocycles")
      .update({
        name: patch.name.trim() || "Mésocycle",
        kind: patch.kind,
        color: patch.color ?? null,
      })
      .eq("id", patch.id)
      .eq("macrocycle_id", id);
    if (e) return { error: e.message };
  }

  // Re-anchor every microcycle in row order: recompute start_date + week_number
  // from the new preseason monday and the new first-match offset.
  for (let i = 0; i < (existingMicros?.length ?? 0); i++) {
    const micro = existingMicros![i];
    const newStart = ymdUTC(addDaysUTC(newPreseasonMon, i * 7));
    const newWeekNum =
      i < newFirstMatchIdx ? i - newFirstMatchIdx : i - newFirstMatchIdx + 1;
    const { error: e } = await supabase
      .from("microcycles")
      .update({ start_date: newStart, week_number: newWeekNum })
      .eq("id", micro.id);
    if (e) return { error: e.message };
  }

  revalidatePath(`/${locale}/planner/${teamId}`);
  return { ok: true };
}

export async function addMesocycleAction(formData: FormData) {
  const macroId = String(formData.get("macroId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "custom") as
    | "preparation"
    | "competition"
    | "transition"
    | "custom";
  const color = String(formData.get("color") ?? "") || null;
  const weekCount = Number(formData.get("weekCount") ?? 0);
  if (!macroId || !teamId) return { error: "Missing fields" };
  if (!Number.isFinite(weekCount) || weekCount <= 0 || weekCount > 26) {
    return { error: "Week count must be between 1 and 26" };
  }
  if (!["preparation", "competition", "transition", "custom"].includes(kind)) {
    return { error: "Invalid kind" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: macro, error: macroErr } = await supabase
    .from("macrocycles")
    .select("id, preseason_start_date, first_match_date, end_date")
    .eq("id", macroId)
    .single();
  if (macroErr || !macro) return { error: macroErr?.message ?? "Tour not found" };

  const { data: existingMesos, error: mesoFetchErr } = await supabase
    .from("mesocycles")
    .select("id, order_index")
    .eq("macrocycle_id", macroId)
    .order("order_index", { ascending: false })
    .limit(1);
  if (mesoFetchErr) return { error: mesoFetchErr.message };
  const nextOrder = (existingMesos?.[0]?.order_index ?? -1) + 1;

  const { data: allMesos } = await supabase
    .from("mesocycles")
    .select("id")
    .eq("macrocycle_id", macroId);
  const allMesoIds = (allMesos ?? []).map((m) => m.id);

  const { data: existingMicros, error: microFetchErr } = allMesoIds.length
    ? await supabase
        .from("microcycles")
        .select("start_date, week_number")
        .in("mesocycle_id", allMesoIds)
        .order("start_date", { ascending: false })
        .limit(1)
    : { data: [] as { start_date: string; week_number: number }[], error: null };
  if (microFetchErr) return { error: microFetchErr.message };

  const preseasonMon = mondayOf(macro.preseason_start_date);
  const firstMatchMon = mondayOf(macro.first_match_date);
  const firstMatchIdx = diffWeeks(preseasonMon, firstMatchMon);

  const nextStartIdx =
    existingMicros && existingMicros.length > 0
      ? diffWeeks(preseasonMon, mondayOf(existingMicros[0].start_date)) + 1
      : 0;

  const { data: insertedMeso, error: insertMesoErr } = await supabase
    .from("mesocycles")
    .insert({
      macrocycle_id: macroId,
      trainer_id: user.id,
      name: name || `Mésocycle ${nextOrder + 1}`,
      kind,
      order_index: nextOrder,
      color,
    })
    .select("id")
    .single();
  if (insertMesoErr || !insertedMeso) {
    return { error: insertMesoErr?.message ?? "Mesocycle insert failed" };
  }

  const microRows = Array.from({ length: weekCount }, (_, i) => {
    const idx = nextStartIdx + i;
    const startDate = ymdUTC(addDaysUTC(preseasonMon, idx * 7));
    const weekNum = idx < firstMatchIdx ? idx - firstMatchIdx : idx - firstMatchIdx + 1;
    return {
      mesocycle_id: insertedMeso.id,
      trainer_id: user.id,
      start_date: startDate,
      week_number: weekNum,
    };
  });
  const { error: microInsertErr } = await supabase.from("microcycles").insert(microRows);
  if (microInsertErr) return { error: microInsertErr.message };

  const newEndIdx = nextStartIdx + weekCount - 1;
  const newEndDate = ymdUTC(addDaysUTC(preseasonMon, newEndIdx * 7 + 6));
  const { error: macroUpdateErr } = await supabase
    .from("macrocycles")
    .update({ end_date: newEndDate })
    .eq("id", macroId);
  if (macroUpdateErr) return { error: macroUpdateErr.message };

  revalidatePath(`/${locale}/planner/${teamId}`);
  return { ok: true };
}

export async function removeMesocycleAction(formData: FormData) {
  const mesoId = String(formData.get("mesoId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  if (!mesoId || !teamId) return { error: "Missing fields" };

  const supabase = await createClient();

  const { data: meso, error: mesoErr } = await supabase
    .from("mesocycles")
    .select("id, macrocycle_id, order_index")
    .eq("id", mesoId)
    .single();
  if (mesoErr || !meso) return { error: mesoErr?.message ?? "Mesocycle not found" };

  const { data: siblings, error: sibErr } = await supabase
    .from("mesocycles")
    .select("id, order_index")
    .eq("macrocycle_id", meso.macrocycle_id)
    .order("order_index", { ascending: true });
  if (sibErr) return { error: sibErr.message };
  if (!siblings || siblings.length <= 1) {
    return { error: "Cannot remove the last cycle of a tour" };
  }
  const isLast = siblings[siblings.length - 1].id === mesoId;
  if (!isLast) {
    return { error: "Only the last cycle of a tour can be removed" };
  }

  const { count: microCount } = await supabase
    .from("microcycles")
    .select("*", { count: "exact", head: true })
    .eq("mesocycle_id", mesoId);
  const removedWeeks = microCount ?? 0;

  const { data: macro, error: macroFetchErr } = await supabase
    .from("macrocycles")
    .select("id, preseason_start_date, end_date")
    .eq("id", meso.macrocycle_id)
    .single();
  if (macroFetchErr || !macro) {
    return { error: macroFetchErr?.message ?? "Tour not found" };
  }

  const { error: deleteErr } = await supabase.from("mesocycles").delete().eq("id", mesoId);
  if (deleteErr) return { error: deleteErr.message };

  if (removedWeeks > 0) {
    const newEnd = mondayOf(macro.end_date);
    newEnd.setUTCDate(newEnd.getUTCDate() - removedWeeks * 7);
    const newEndDate = ymdUTC(addDaysUTC(newEnd, 6));
    const { error: macroUpdateErr } = await supabase
      .from("macrocycles")
      .update({ end_date: newEndDate })
      .eq("id", meso.macrocycle_id);
    if (macroUpdateErr) return { error: macroUpdateErr.message };
  }

  revalidatePath(`/${locale}/planner/${teamId}`);
  return { ok: true };
}

export async function deleteMacrocycleAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  if (!id) return { error: "Missing id" };

  const supabase = await createClient();
  const { error } = await supabase.from("macrocycles").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${teamId}`);
  return { ok: true };
}
