import type { createClient } from "@/lib/supabase/server";
import type { RosterPlayer } from "@/components/planner/MatchParticipations";

type AssignmentRow = {
  players: {
    id: string;
    first_name: string;
    last_name: string;
    jersey_number: number | null;
  } | null;
};

/** Effectif d'une équipe pour une saison, trié par numéro puis nom. */
export async function loadTeamRoster(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teamId: string,
  season: string,
): Promise<RosterPlayer[]> {
  const { data } = await supabase
    .from("player_team_assignments")
    .select("players (id, first_name, last_name, jersey_number)")
    .eq("team_id", teamId)
    .eq("season", season);

  const assignments = (data ?? []) as unknown as AssignmentRow[];
  return assignments
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
}
