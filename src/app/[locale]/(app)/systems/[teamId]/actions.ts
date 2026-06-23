"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeFormation } from "@/components/planner/match/formations";
import {
  PHASE_KINDS,
  parseBoard,
  parseLineup,
  parseTactics,
  type SystemLineup,
} from "@/lib/planner/tacticalSystems";

type ActionResult = {
  ok?: true;
  id?: string;
  error?:
    | "unauthenticated"
    | "team_not_found"
    | "system_not_found"
    | "invalid_input"
    | "db_error";
};

async function loadTeamAccess(teamId: string): Promise<
  | { ok: true; clubId: string; supabase: Awaited<ReturnType<typeof createClient>> }
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

  return { ok: true, clubId: team.club_id as string, supabase };
}

/** player_id réellement affectés à l'équipe (garde-fou anti-injection). */
async function loadAllowedPlayers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teamId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("player_team_assignments")
    .select("player_id")
    .eq("team_id", teamId);
  return new Set((data ?? []).map((r) => r.player_id as string));
}

/** Restreint les player_id d'un lineup à l'effectif autorisé (sinon null/retiré). */
function sanitizeLineup(lineup: SystemLineup, allowed: Set<string>): SystemLineup {
  return {
    slots: lineup.slots.map((id) => (id && allowed.has(id) ? id : null)),
    coords: lineup.coords,
    subs: lineup.subs.filter((id) => allowed.has(id)),
  };
}

function trimName(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim().slice(0, 120);
}

type PhaseInput = {
  kind: string;
  name: string | null;
  board: ReturnType<typeof parseBoard>;
};

function parsePhases(raw: string): PhaseInput[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const rows: PhaseInput[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const kind = String(r.kind ?? "");
    if (!(PHASE_KINDS as readonly string[]).includes(kind)) continue;
    rows.push({
      kind,
      name:
        typeof r.name === "string" && r.name.trim()
          ? r.name.trim().slice(0, 120)
          : null,
      board: parseBoard(r.board),
    });
  }
  return rows;
}

/** Crée ou met à jour un système (compo + tactique + phases). */
export async function saveSystemAction(formData: FormData): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const systemId = String(formData.get("systemId") ?? "");
  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const name = trimName(formData.get("name"));
  if (!name) return { error: "invalid_input" };
  const formation = normalizeFormation(String(formData.get("formation") ?? ""));

  const allowed = await loadAllowedPlayers(access.supabase, teamId);
  let lineupRaw: unknown;
  try {
    lineupRaw = JSON.parse(String(formData.get("lineup") ?? "{}"));
  } catch {
    return { error: "invalid_input" };
  }
  const lineup = sanitizeLineup(parseLineup(lineupRaw), allowed);

  let tacticsRaw: unknown;
  try {
    tacticsRaw = JSON.parse(String(formData.get("tactics") ?? "{}"));
  } catch {
    return { error: "invalid_input" };
  }
  const tactics = parseTactics(tacticsRaw);

  const phases = parsePhases(String(formData.get("phases") ?? "[]"));
  if (phases === null) return { error: "invalid_input" };

  // Vérifie la propriété du système si édition.
  let id = systemId;
  if (systemId) {
    const { data: existing } = await access.supabase
      .from("team_tactical_systems")
      .select("id")
      .eq("id", systemId)
      .eq("team_id", teamId)
      .maybeSingle();
    if (!existing) return { error: "system_not_found" };
    const { error } = await access.supabase
      .from("team_tactical_systems")
      .update({ name, formation, lineup, tactics, updated_at: new Date().toISOString() })
      .eq("id", systemId)
      .eq("team_id", teamId);
    if (error) return { error: "db_error" };
  } else {
    const { data, error } = await access.supabase
      .from("team_tactical_systems")
      .insert({ team_id: teamId, club_id: access.clubId, name, formation, lineup, tactics })
      .select("id")
      .single();
    if (error || !data) return { error: "db_error" };
    id = data.id as string;
  }

  // Phases : remplacement complet (delete + insert), comme la timeline d'événements.
  const { error: delErr } = await access.supabase
    .from("team_tactical_phases")
    .delete()
    .eq("system_id", id);
  if (delErr) return { error: "db_error" };

  if (phases.length > 0) {
    const { error: insErr } = await access.supabase
      .from("team_tactical_phases")
      .insert(
        phases.map((p, i) => ({
          system_id: id,
          club_id: access.clubId,
          kind: p.kind,
          name: p.name,
          board: p.board,
          sort_order: i,
        })),
      );
    if (insErr) return { error: "db_error" };
  }

  revalidatePath(`/[locale]/systems/${teamId}`, "page");
  return { ok: true, id };
}

/** Duplique un système (et ses phases) de la même équipe. */
export async function duplicateSystemAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const systemId = String(formData.get("systemId") ?? "");
  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { data: src } = await access.supabase
    .from("team_tactical_systems")
    .select("name, formation, lineup, tactics")
    .eq("id", systemId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!src) return { error: "system_not_found" };

  const { data: created, error } = await access.supabase
    .from("team_tactical_systems")
    .insert({
      team_id: teamId,
      club_id: access.clubId,
      name: `${(src.name as string).slice(0, 110)} (copie)`,
      formation: src.formation,
      lineup: src.lineup,
      tactics: src.tactics,
    })
    .select("id")
    .single();
  if (error || !created) return { error: "db_error" };

  const { data: phases } = await access.supabase
    .from("team_tactical_phases")
    .select("kind, name, board, sort_order")
    .eq("system_id", systemId);
  if (phases && phases.length > 0) {
    await access.supabase.from("team_tactical_phases").insert(
      phases.map((p) => ({
        system_id: created.id,
        club_id: access.clubId,
        kind: p.kind,
        name: p.name,
        board: p.board,
        sort_order: p.sort_order,
      })),
    );
  }

  revalidatePath(`/[locale]/systems/${teamId}`, "page");
  return { ok: true, id: created.id as string };
}

/** Supprime un système (les phases tombent en cascade). */
export async function deleteSystemAction(
  formData: FormData,
): Promise<ActionResult> {
  const teamId = String(formData.get("teamId") ?? "");
  const systemId = String(formData.get("systemId") ?? "");
  const access = await loadTeamAccess(teamId);
  if (!access.ok) return { error: access.error };

  const { error } = await access.supabase
    .from("team_tactical_systems")
    .delete()
    .eq("id", systemId)
    .eq("team_id", teamId);
  if (error) return { error: "db_error" };

  revalidatePath(`/[locale]/systems/${teamId}`, "page");
  return { ok: true };
}
