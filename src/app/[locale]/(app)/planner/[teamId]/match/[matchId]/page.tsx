import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { MatchHub, type WeekSession } from "@/components/planner/MatchHub";
import type {
  ParticipationState,
  ParticipationStatus,
  RosterPlayer,
} from "@/components/planner/MatchParticipations";
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
  status: ParticipationStatus;
  minutes: number | null;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_card: boolean;
};

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
      "id, starts_at, ends_at, summary, location, match_url, kind, home_away, opponent, competition, is_anchor, source, archived, home_score, away_score, result_note",
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

  // Effectif de la saison du match + feuille de match déjà saisie.
  const matchSeason = currentSeasonLabel(new Date(match.starts_at as string));
  const [{ data: assignmentsRaw }, { data: participationsRaw }] =
    await Promise.all([
      supabase
        .from("player_team_assignments")
        .select("players (id, first_name, last_name, jersey_number)")
        .eq("team_id", teamId)
        .eq("season", matchSeason),
      supabase
        .from("match_participations")
        .select(
          "player_id, status, minutes, goals, assists, yellow_cards, red_card",
        )
        .eq("match_id", matchId),
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

  const participations: Record<string, ParticipationState> = {};
  for (const row of (participationsRaw ?? []) as ParticipationRow[]) {
    participations[row.player_id] = {
      status: row.status,
      minutes: row.minutes,
      goals: row.goals,
      assists: row.assists,
      yellowCards: row.yellow_cards,
      redCard: row.red_card,
    };
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <MatchHub
        teamId={teamId}
        roster={roster}
        participations={participations}
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
