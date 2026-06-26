import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { MatchHub, type WeekSession } from "@/components/planner/MatchHub";
import type { RosterPlayer } from "@/components/planner/MatchParticipations";
import type {
  LineupValue,
  UnavailableMap,
} from "@/components/planner/LineupBoard";
import type { TacticsValue } from "@/components/planner/MatchTactics";
import type { CallupInfo } from "@/components/planner/MatchCallup";
import type { MatchEvent, MatchEventType } from "@/components/planner/MatchEventsTimeline";
import type {
  DerivedStat,
  SquadRecapRow,
} from "@/components/planner/MatchSquadRecap";
import {
  FORMATIONS,
  normalizeFormation,
} from "@/components/planner/match/formations";
import {
  activeUnavailability,
  type Unavailability,
  type UnavailabilityKind,
} from "@/lib/availability/unavailability";
import {
  PHASE_KINDS,
  parseBoard,
  parseLineup,
  parseTactics,
  type PhaseKind,
  type TacticalPhase,
  type TacticalSystem,
} from "@/lib/planner/tacticalSystems";
import { requireUser } from "@/lib/auth/getUser";
import { resolveCurrentMembership } from "@/lib/club/context";
import { currentSeasonLabel } from "@/lib/planner/seasons";

type AssignmentRow = {
  players: {
    id: string;
    first_name: string;
    last_name: string;
    jersey_number: number | null;
  } | null;
};

type ParticipationRow = {
  player_id: string;
  status: "starter" | "substitute" | "unused" | "unavailable";
  minutes: number | null;
  called_up: boolean;
  availability: "available" | "unavailable" | null;
  availability_reason: string | null;
  pitch_x: number | null;
  pitch_y: number | null;
  slot_role: string | null;
};

type UnavailDbRow = {
  player_id: string;
  kind: UnavailabilityKind;
  reason: string | null;
  start_date: string;
  end_date: string | null;
};

type EventRow = {
  type: MatchEventType;
  minute: number | null;
  player_id: string | null;
  related_player_id: string | null;
  is_penalty: boolean;
  note: string | null;
};

function tacticsFrom(raw: unknown): TacticsValue {
  const o = (raw ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const objective = s("objective") || s("general");
  const loss = s("loss") || s("transition");
  return {
    coaches: s("coaches"),
    matchContext: s("matchContext"),
    structures: s("structures"),
    boards: {
      possession: parseBoard((o.boards as Record<string, unknown> | undefined)?.possession),
      defense: parseBoard((o.boards as Record<string, unknown> | undefined)?.defense),
      loss: parseBoard((o.boards as Record<string, unknown> | undefined)?.loss),
      regain: parseBoard((o.boards as Record<string, unknown> | undefined)?.regain),
    },
    objective,
    general: s("general") || objective,
    possession: s("possession"),
    defense: s("defense"),
    loss,
    regain: s("regain"),
    transition: s("transition") || loss,
  };
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string; matchId: string }>;
}) {
  const { locale, teamId, matchId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const membership = await resolveCurrentMembership();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .single();
  if (!team) notFound();

  const { data: match } = await supabase
    .from("team_matches")
    .select(
      "id, starts_at, ends_at, summary, location, match_url, kind, home_away, opponent, competition, is_anchor, source, archived, home_score, away_score, result_note, formation, tactics, selected_phase_ids, convocation_sent_at",
    )
    .eq("id", matchId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!match) notFound();

  // Microcycle qui prépare ce match → ses séances, étiquetées MD-.
  const { data: micro } = await supabase
    .from("microcycles")
    .select("id")
    .eq("team_id", teamId)
    .eq("target_match_id", matchId)
    .maybeSingle();

  let weekSessions: WeekSession[] = [];
  if (micro) {
    const { data: sessionRows } = await supabase
      .from("sessions")
      .select("id, date, start_time, theme, md_offset")
      .eq("team_id", teamId)
      .eq("microcycle_id", micro.id)
      .order("date", { ascending: true });
    weekSessions = (sessionRows ?? []).map((s) => ({
      id: s.id as string,
      date: s.date as string,
      startTime: (s.start_time as string | null) ?? null,
      theme: (s.theme as string | null) ?? null,
      mdOffset: (s.md_offset as number | null) ?? null,
    }));
  }

  // Effectif de la saison du match + participations + événements.
  const matchSeason = currentSeasonLabel(new Date(match.starts_at as string));
  const [{ data: assignmentsRaw }, { data: participationsRaw }, { data: eventsRaw }] =
    await Promise.all([
      supabase
        .from("player_team_assignments")
        .select("players (id, first_name, last_name, jersey_number)")
        .eq("team_id", teamId)
        .eq("season", matchSeason),
      supabase
        .from("match_participations")
        .select(
          "player_id, status, minutes, called_up, availability, availability_reason, pitch_x, pitch_y, slot_role",
        )
        .eq("match_id", matchId),
      supabase
        .from("match_events")
        .select("type, minute, player_id, related_player_id, is_penalty, note")
        .eq("match_id", matchId)
        .order("sort_order", { ascending: true }),
    ]);

  const assignments = (assignmentsRaw ?? []) as unknown as AssignmentRow[];
  const roster: RosterPlayer[] = assignments
    .map((a) => a.players)
    .filter((p): p is NonNullable<AssignmentRow["players"]> => p !== null)
    .map((p) => ({
      playerId: p.id,
      fullName: `${p.first_name} ${p.last_name}`.trim(),
      jerseyNumber: p.jersey_number,
    }))
    .sort((a, b) => {
      if (a.jerseyNumber !== null && b.jerseyNumber !== null) {
        return a.jerseyNumber - b.jerseyNumber;
      }
      if (a.jerseyNumber !== null) return -1;
      if (b.jerseyNumber !== null) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  const rosterById = new Map(roster.map((p) => [p.playerId, p]));

  const participations = (participationsRaw ?? []) as ParticipationRow[];

  // Indisponibilités médicales actives à la date du match (blessé/suspendu/malade/…).
  const matchDate = (match.starts_at as string).slice(0, 10);
  const unavailable: UnavailableMap = {};
  if (roster.length > 0) {
    const { data: unavailRows } = await supabase
      .from("player_unavailability")
      .select("player_id, kind, reason, start_date, end_date")
      .in(
        "player_id",
        roster.map((p) => p.playerId),
      )
      .lte("start_date", matchDate)
      .or(`end_date.is.null,end_date.gte.${matchDate}`);
    const byPlayer = new Map<string, Unavailability[]>();
    for (const r of (unavailRows ?? []) as UnavailDbRow[]) {
      const list = byPlayer.get(r.player_id) ?? [];
      list.push({
        id: "",
        playerId: r.player_id,
        kind: r.kind,
        reason: r.reason,
        startDate: r.start_date,
        endDate: r.end_date,
      });
      byPlayer.set(r.player_id, list);
    }
    for (const [playerId, list] of byPlayer) {
      const active = activeUnavailability(list, matchDate);
      if (active) unavailable[playerId] = { kind: active.kind, reason: active.reason };
    }
  }

  // Compo initiale : reconstruction du modèle « par poste » depuis les
  // participations sauvegardées (titulaires placés + remplaçants convoqués).
  const formation = normalizeFormation(match.formation as string | null);
  const formationSlots = FORMATIONS[formation] ?? [];
  const savedStarters = participations
    .filter(
      (p) =>
        p.status === "starter" && p.pitch_x !== null && p.pitch_y !== null,
    )
    .map((p) => ({
      playerId: p.player_id,
      x: p.pitch_x as number,
      y: p.pitch_y as number,
      role: p.slot_role ?? "",
    }));
  const slots: (string | null)[] = Array(formationSlots.length).fill(null);
  const coords: Record<number, { x: number; y: number }> = {};
  for (const st of savedStarters) {
    let best = -1;
    let bestCost = Infinity;
    for (let i = 0; i < formationSlots.length; i++) {
      if (slots[i]) continue;
      const sl = formationSlots[i];
      const dist = Math.hypot(sl.x - st.x, sl.y - st.y);
      const cost = (sl.role === st.role ? 0 : 1000) + dist;
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    }
    if (best === -1) continue; // plus de titulaires que de postes (formation changée)
    slots[best] = st.playerId;
    const sl = formationSlots[best];
    if (Math.round(sl.x) !== Math.round(st.x) || Math.round(sl.y) !== Math.round(st.y)) {
      coords[best] = { x: st.x, y: st.y };
    }
  }
  const starterSet = new Set(slots.filter((s): s is string => Boolean(s)));
  const subs = roster
    .filter((p) => {
      const part = participations.find((x) => x.player_id === p.playerId);
      return part?.called_up && !starterSet.has(p.playerId);
    })
    .map((p) => p.playerId);
  const lineupInitial: LineupValue = { formation, slots, coords, subs };

  const tacticsInitial = tacticsFrom(match.tactics);

  const callupInitial: Record<string, CallupInfo> = {};
  for (const p of participations) {
    callupInitial[p.player_id] = {
      calledUp: p.called_up,
      availability: p.availability,
      availabilityReason: p.availability_reason,
    };
  }

  const events = (eventsRaw ?? []) as EventRow[];
  const eventsInitial: MatchEvent[] = events.map((e) => ({
    type: e.type,
    minute: e.minute,
    playerId: e.player_id,
    relatedPlayerId: e.related_player_id,
    isPenalty: e.is_penalty,
    note: e.note,
  }));

  // Stats dérivées des événements (buts/passes/cartons par joueur).
  const derived: Record<string, DerivedStat> = {};
  const bump = (id: string | null): DerivedStat | null => {
    if (!id) return null;
    if (!derived[id]) derived[id] = { goals: 0, assists: 0, yellow: 0, red: false };
    return derived[id];
  };
  for (const e of events) {
    if (e.type === "goal") {
      const s = bump(e.player_id);
      if (s) s.goals += 1;
      const a = bump(e.related_player_id);
      if (a) a.assists += 1;
    } else if (e.type === "yellow") {
      const s = bump(e.player_id);
      if (s) s.yellow += 1;
    } else if (e.type === "red") {
      const s = bump(e.player_id);
      if (s) s.red = true;
    }
  }

  // Récap feuille de match : joueurs convoqués ou ayant un statut de jeu.
  const squadRecap: SquadRecapRow[] = participations
    .filter((p) => rosterById.has(p.player_id) && (p.called_up || p.minutes !== null))
    .map((p) => {
      const r = rosterById.get(p.player_id)!;
      return {
        playerId: p.player_id,
        fullName: r.fullName,
        jerseyNumber: r.jerseyNumber,
        status: p.status,
        minutes: p.minutes,
      };
    });

  // Systèmes de jeu de l'équipe (pour l'import dans la compo + sélection de phases).
  const { data: systemRows } = await supabase
    .from("team_tactical_systems")
    .select("id, name, formation, lineup, tactics")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });
  const sysList = systemRows ?? [];
  const sysIds = sysList.map((s) => s.id as string);
  const phasesBySystem = new Map<string, TacticalPhase[]>();
  if (sysIds.length > 0) {
    const { data: phaseRows } = await supabase
      .from("team_tactical_phases")
      .select("id, system_id, kind, name, board, sort_order")
      .in("system_id", sysIds)
      .order("sort_order", { ascending: true });
    for (const p of phaseRows ?? []) {
      if (!(PHASE_KINDS as readonly string[]).includes(p.kind as string)) continue;
      const arr = phasesBySystem.get(p.system_id as string) ?? [];
      arr.push({
        id: p.id as string,
        kind: p.kind as PhaseKind,
        name: (p.name as string | null) ?? null,
        board: parseBoard(p.board),
      });
      phasesBySystem.set(p.system_id as string, arr);
    }
  }
  const systems: TacticalSystem[] = sysList.map((s) => ({
    id: s.id as string,
    name: s.name as string,
    formation: normalizeFormation(s.formation as string | null),
    lineup: parseLineup(s.lineup),
    tactics: parseTactics(s.tactics),
    phases: phasesBySystem.get(s.id as string) ?? [],
  }));
  const selectedPhaseIds = Array.isArray(match.selected_phase_ids)
    ? (match.selected_phase_ids as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <MatchHub
        teamId={teamId}
        roster={roster}
        unavailable={unavailable}
        systems={systems}
        selectedPhaseIds={selectedPhaseIds}
        lineupInitial={lineupInitial}
        tacticsInitial={tacticsInitial}
        callupInitial={callupInitial}
        eventsInitial={eventsInitial}
        squadRecap={squadRecap}
        derived={derived}
        match={{
          id: match.id as string,
          starts_at: match.starts_at as string,
          ends_at: (match.ends_at as string | null) ?? null,
          summary: (match.summary as string | null) ?? null,
          location: (match.location as string | null) ?? null,
          match_url: (match.match_url as string | null) ?? null,
          kind: (match.kind as string | null) ?? null,
          home_away: (match.home_away as string | null) ?? null,
          opponent: (match.opponent as string | null) ?? null,
          competition: (match.competition as string | null) ?? null,
          is_anchor: Boolean(match.is_anchor),
          source: match.source as string,
          archived: Boolean(match.archived),
          home_score: (match.home_score as number | null) ?? null,
          away_score: (match.away_score as number | null) ?? null,
          result_note: (match.result_note as string | null) ?? null,
          convocation_sent_at:
            (match.convocation_sent_at as string | null) ?? null,
        }}
        weekSessions={weekSessions}
        clubLogoUrl={membership?.logo_url ?? null}
      />
    </div>
  );
}
