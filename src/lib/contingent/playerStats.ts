import "server-only";

import type { createClient } from "@/lib/supabase/server";
import {
  activeUnavailability,
  type Unavailability,
  type UnavailabilityKind,
} from "@/lib/availability/unavailability";

/**
 * Agrégations « par joueur » réutilisées par la liste contingent, l'onglet
 * Aperçu et l'onglet Stats de la fiche. Centralisé ici pour éviter la
 * recomputation client et préparer un passage en RPC SQL (Lot 5).
 */

export type PlayerOverviewStat = {
  /** Séances d'entraînement passées des équipes du joueur (saison courante). */
  sessionsTotal: number;
  /** Séances où la présence réelle = présent. */
  sessionsPresent: number;
  /** sessionsPresent / sessionsTotal, ou null si aucune séance. */
  presenceRate: number | null;
  /** Indisponibilité active aujourd'hui (médical/discipline), sinon null. */
  activeUnavailability: { kind: UnavailabilityKind; reason: string | null } | null;
};

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const EMPTY: PlayerOverviewStat = {
  sessionsTotal: 0,
  sessionsPresent: 0,
  presenceRate: null,
  activeUnavailability: null,
};

/** Début de saison (1er juillet de la 1re année du label "YYYY/YYYY+1"). */
function seasonStartISO(season: string): string {
  const year = Number(season.slice(0, 4));
  return Number.isFinite(year) ? `${year}-07-01` : "1970-01-01";
}

export async function getPlayersOverview(
  supabase: SupabaseServer,
  {
    season,
    playerIds,
  }: {
    season: string;
    playerIds: string[];
  },
): Promise<Map<string, PlayerOverviewStat>> {
  const result = new Map<string, PlayerOverviewStat>();
  for (const id of playerIds) result.set(id, { ...EMPTY });
  if (playerIds.length === 0) return result;

  const today = new Date().toISOString().slice(0, 10);
  const start = seasonStartISO(season);

  // 1. Équipes du joueur cette saison.
  const { data: assignmentRows } = await supabase
    .from("player_team_assignments")
    .select("player_id, team_id")
    .in("player_id", playerIds)
    .eq("season", season);

  const teamsByPlayer = new Map<string, string[]>();
  const allTeamIds = new Set<string>();
  for (const a of assignmentRows ?? []) {
    const arr = teamsByPlayer.get(a.player_id as string) ?? [];
    arr.push(a.team_id as string);
    teamsByPlayer.set(a.player_id as string, arr);
    allTeamIds.add(a.team_id as string);
  }

  // 2. Séances d'entraînement passées de ces équipes (saison courante).
  const teamIds = Array.from(allTeamIds);
  const { data: sessionRows } = teamIds.length
    ? await supabase
        .from("sessions")
        .select("id, team_id")
        .in("team_id", teamIds)
        .eq("kind", "training")
        .gte("date", start)
        .lte("date", today)
    : { data: [] as { id: string; team_id: string }[] };

  const sessionsByTeam = new Map<string, string[]>();
  const allSessionIds: string[] = [];
  for (const s of sessionRows ?? []) {
    const arr = sessionsByTeam.get(s.team_id as string) ?? [];
    arr.push(s.id as string);
    sessionsByTeam.set(s.team_id as string, arr);
    allSessionIds.push(s.id as string);
  }

  // 3. Présence = statut réel saisi, sinon réponse RSVP du joueur (auto-lien).
  const { data: attendanceRows } = allSessionIds.length
    ? await supabase
        .from("session_attendances")
        .select("player_id, session_id, actual_status, announced_status")
        .in("session_id", allSessionIds)
        .in("player_id", playerIds)
    : {
        data: [] as {
          player_id: string;
          session_id: string;
          actual_status: string | null;
          announced_status: string | null;
        }[],
      };

  const presentSet = new Set<string>(); // `${playerId}|${sessionId}`
  for (const r of attendanceRows ?? []) {
    const effective = r.actual_status ?? r.announced_status;
    if (effective === "present") {
      presentSet.add(`${r.player_id}|${r.session_id}`);
    }
  }

  // 4. Indisponibilités actives aujourd'hui.
  const { data: unavailRows } = await supabase
    .from("player_unavailability")
    .select("player_id, kind, reason, start_date, end_date")
    .in("player_id", playerIds)
    .lte("start_date", today)
    .or(`end_date.is.null,end_date.gte.${today}`);

  const unavailByPlayer = new Map<string, Unavailability[]>();
  for (const u of unavailRows ?? []) {
    const arr = unavailByPlayer.get(u.player_id as string) ?? [];
    arr.push({
      id: "",
      playerId: u.player_id as string,
      kind: u.kind as UnavailabilityKind,
      reason: (u.reason as string | null) ?? null,
      startDate: u.start_date as string,
      endDate: (u.end_date as string | null) ?? null,
    });
    unavailByPlayer.set(u.player_id as string, arr);
  }

  // 5. Composition par joueur.
  for (const playerId of playerIds) {
    const teamList = teamsByPlayer.get(playerId) ?? [];
    const sessionIds = teamList.flatMap((tid) => sessionsByTeam.get(tid) ?? []);
    const sessionsTotal = sessionIds.length;
    let sessionsPresent = 0;
    for (const sid of sessionIds) {
      if (presentSet.has(`${playerId}|${sid}`)) sessionsPresent += 1;
    }
    const active = activeUnavailability(unavailByPlayer.get(playerId) ?? [], today);
    result.set(playerId, {
      sessionsTotal,
      sessionsPresent,
      presenceRate: sessionsTotal > 0 ? sessionsPresent / sessionsTotal : null,
      activeUnavailability: active
        ? { kind: active.kind, reason: active.reason }
        : null,
    });
  }

  return result;
}
