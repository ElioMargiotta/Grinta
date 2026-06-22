import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { MatchHub, type WeekSession } from "@/components/planner/MatchHub";
import { requireUser } from "@/lib/auth/getUser";

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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <MatchHub
        teamId={teamId}
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
