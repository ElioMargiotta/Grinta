import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { MatchHub, type WeekSession } from "@/components/planner/MatchHub";
import type { RosterPlayer } from "@/components/planner/MatchParticipations";
import type { LineupValue, BenchRole } from "@/components/planner/LineupBoard";
import type { TacticsValue } from "@/components/planner/MatchTactics";
import type { CallupInfo } from "@/components/planner/MatchCallup";
import type { MatchEvent, MatchEventType } from "@/components/planner/MatchEventsTimeline";
import type {
  DerivedStat,
  SquadRecapRow,
} from "@/components/planner/MatchSquadRecap";
import { DEFAULT_FORMATION } from "@/components/planner/match/formations";
import { requireUser } from "@/lib/auth/getUser";
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
  return {
    general: s("general"),
    possession: s("possession"),
    defense: s("defense"),
    transition: s("transition"),
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

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .single();
  if (!team) notFound();

  const { data: match } = await supabase
    .from("team_matches")
    .select(
      "id, starts_at, ends_at, summary, location, match_url, kind, home_away, opponent, competition, is_anchor, source, archived, home_score, away_score, result_note, formation, tactics",
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
  const partByPlayer = new Map(participations.map((p) => [p.player_id, p]));

  // Convoqués (called_up), dans l'ordre du roster.
  const convened = roster.filter(
    (p) => partByPlayer.get(p.playerId)?.called_up,
  );

  // Compo initiale : titulaires placés + bancs.
  const starters = participations
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
  const starterSet = new Set(starters.map((s) => s.playerId));
  const bench: Record<string, BenchRole> = {};
  for (const p of participations) {
    if (!p.called_up || starterSet.has(p.player_id)) continue;
    bench[p.player_id] = p.status === "unused" ? "unused" : "substitute";
  }
  const lineupInitial: LineupValue = {
    formation: (match.formation as string | null) ?? DEFAULT_FORMATION,
    starters,
    bench,
  };

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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <MatchHub
        teamId={teamId}
        roster={roster}
        convened={convened}
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
        }}
        weekSessions={weekSessions}
      />
    </div>
  );
}
