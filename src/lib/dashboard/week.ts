import "server-only";
import { createClient } from "@/lib/supabase/server";
import { seasonWindow } from "@/lib/planner/seasons";

/**
 * Données du widget « Cette semaine » du tableau de bord.
 *
 * On reste volontairement club-wide (toutes les équipes actives de la saison),
 * en lecture seule : le dashboard est un point d'entrée, pas un outil d'édition.
 * Le scope par équipe (access_level `team`) pourra affiner ça plus tard.
 *
 * Convention dates : semaine ISO (lundi → dimanche). Les matchs portent un
 * `starts_at` (timestamptz) ; les séances une `date` civile. On calcule la
 * fenêtre en dates civiles locales et on la projette en bornes UTC pour les
 * matchs — suffisant pour un tableau de bord (pas de précision DST requise).
 */

export type WeekMatch = {
  id: string;
  teamId: string;
  teamName: string;
  startsAt: string;
  opponent: string | null;
  homeAway: "home" | "away" | null;
  kind: string;
  location: string | null;
  homeScore: number | null;
  awayScore: number | null;
  archived: boolean;
};

export type SessionKind = "training" | "physical_eval";

export type WeekSession = {
  id: string;
  teamId: string;
  teamName: string;
  date: string;
  startTime: string | null;
  theme: string | null;
  /** `physical_eval` = évaluation physique (affichée à part des entraînements). */
  kind: SessionKind;
};

export type NextMatch = WeekMatch & { dayOffset: number };

export type WeekOverview = {
  weekStart: string; // YYYY-MM-DD (lundi)
  weekEnd: string; // YYYY-MM-DD (dimanche)
  /** Équipes actives de la saison (pour le filtre du tableau de bord). */
  teams: { id: string; name: string }[];
  matches: WeekMatch[];
  sessions: WeekSession[];
  /** Prochain match toutes équipes confondues, avec son écart en jours. */
  nextMatch: NextMatch | null;
  /** Prochain match par équipe (clé = teamId), pour le filtre par équipe. */
  nextByTeam: Record<string, NextMatch>;
};

/** Lundi de la semaine contenant `d`, en date civile YYYY-MM-DD. */
function mondayOf(d: Date): string {
  const day = d.getDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return toYmd(monday);
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return toYmd(dt);
}

/** Écart en jours civils entre aujourd'hui et une date (négatif = passé). */
function dayOffsetFromToday(iso: string): number {
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const target = new Date(iso);
  const t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((t1 - t0) / 86_400_000);
}

export async function getClubWeekOverview(
  clubId: string,
  season: string,
): Promise<WeekOverview> {
  const supabase = await createClient();

  const now = new Date();
  const weekStart = mondayOf(now);
  const weekEnd = addDays(weekStart, 6); // dimanche
  const weekEndExclusive = addDays(weekStart, 7); // lundi suivant

  // Équipes actives de la saison courante pour ce club.
  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, team_seasons!inner(season)")
    .eq("club_id", clubId)
    .is("archived_at", null)
    .eq("team_seasons.season", season);

  // L'inner join sur team_seasons peut renvoyer une ligne par saison : on
  // déduplique par id avant de trier.
  const byId = new Map<string, { id: string; name: string }>();
  for (const t of (teamRows ?? []) as { id: string; name: string }[]) {
    if (!byId.has(t.id)) byId.set(t.id, { id: t.id, name: t.name });
  }
  const teams = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  const teamIds = teams.map((t) => t.id);
  if (teamIds.length === 0) {
    return { weekStart, weekEnd, teams, matches: [], sessions: [], nextMatch: null, nextByTeam: {} };
  }

  const nameById = new Map(teams.map((t) => [t.id, t.name]));
  const seasonBounds = seasonWindow(season);

  const [matchesRes, sessionsRes, nextRes] = await Promise.all([
    supabase
      .from("team_matches")
      .select(
        "id, team_id, starts_at, opponent, home_away, kind, location, home_score, away_score, archived",
      )
      .in("team_id", teamIds)
      .gte("starts_at", `${weekStart}T00:00:00Z`)
      .lt("starts_at", `${weekEndExclusive}T00:00:00Z`)
      .order("starts_at", { ascending: true }),
    supabase
      .from("sessions")
      .select("id, team_id, date, start_time, theme, kind")
      .in("team_id", teamIds)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: true }),
    // Matchs à venir, bornés à la saison, hors pauses — on en dérive le prochain
    // match global ET le prochain match de chaque équipe (pour le filtre).
    supabase
      .from("team_matches")
      .select(
        "id, team_id, starts_at, opponent, home_away, kind, location, home_score, away_score, archived",
      )
      .in("team_id", teamIds)
      .neq("kind", "break")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", `${seasonBounds.end}T23:59:59Z`)
      .order("starts_at", { ascending: true }),
  ]);

  const toMatch = (r: Record<string, unknown>): WeekMatch => ({
    id: r.id as string,
    teamId: r.team_id as string,
    teamName: nameById.get(r.team_id as string) ?? "—",
    startsAt: r.starts_at as string,
    opponent: (r.opponent as string | null) ?? null,
    homeAway: (r.home_away as "home" | "away" | null) ?? null,
    kind: (r.kind as string) ?? "league",
    location: (r.location as string | null) ?? null,
    homeScore: (r.home_score as number | null) ?? null,
    awayScore: (r.away_score as number | null) ?? null,
    archived: Boolean(r.archived),
  });

  const matches = (matchesRes.data ?? []).map(toMatch);
  const sessions = ((sessionsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    teamId: r.team_id as string,
    teamName: nameById.get(r.team_id as string) ?? "—",
    date: r.date as string,
    startTime: (r.start_time as string | null) ?? null,
    theme: (r.theme as string | null) ?? null,
    kind: ((r.kind as string) === "physical_eval" ? "physical_eval" : "training") as SessionKind,
  }));

  // `nextRes` est trié par date croissante : la 1re occurrence de chaque équipe
  // est son prochain match, et la toute 1re ligne le prochain match global.
  const upcoming = (nextRes.data ?? []) as Record<string, unknown>[];
  const nextByTeam: Record<string, NextMatch> = {};
  for (const r of upcoming) {
    const teamId = r.team_id as string;
    if (nextByTeam[teamId]) continue;
    nextByTeam[teamId] = { ...toMatch(r), dayOffset: dayOffsetFromToday(r.starts_at as string) };
  }
  const nextMatch = upcoming[0]
    ? { ...toMatch(upcoming[0]), dayOffset: dayOffsetFromToday(upcoming[0].starts_at as string) }
    : null;

  return { weekStart, weekEnd, teams, matches, sessions, nextMatch, nextByTeam };
}
