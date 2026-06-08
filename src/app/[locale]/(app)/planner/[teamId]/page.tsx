import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  PlannerCalendar,
  type PlannerView,
} from "@/components/planner/PlannerCalendar";
import { type Macrocycle } from "@/components/planner/PlannerTourView";
import { FOCUS_FAMILIES, type FocusFamily } from "@/components/sheet/types";
import { requireUser } from "@/lib/auth/getUser";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";
import { archivePastMatches } from "@/lib/calendar/sync";
import { seasonWindow } from "@/lib/planner/seasons";

const VALID_VIEWS: PlannerView[] = ["season", "weekly"];

export default async function PlannerTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; teamId: string }>;
  searchParams: Promise<{ view?: string; season?: string }>;
}) {
  const { locale, teamId } = await params;
  const { view: viewParam, season: seasonParam } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("planner");

  const view: PlannerView = (VALID_VIEWS as string[]).includes(viewParam ?? "")
    ? (viewParam as PlannerView)
    : "season";

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, season")
    .eq("id", teamId)
    .single();
  if (!team) notFound();

  // Saison active : pilotée globalement (Topbar). Param `?season=` toléré pour
  // les liens profonds, sinon on prend la saison active du club. Isolation par
  // fenêtre de dates du millésime (juil. → juin) — Hebdo + Saison + matchs.
  const season =
    seasonParam && /^\d{4}\/\d{2}$/.test(seasonParam)
      ? seasonParam
      : await resolveCurrentSeasonLabel();
  const window = seasonWindow(season);
  const winStartIso = `${window.start}T00:00:00.000Z`;
  const winEndIso = `${window.end}T23:59:59.999Z`;

  // Modèle « calendrier vivant » : on archive d'abord les matchs joués (détachés
  // de l'ICS), puis on ne charge que le calendrier ACTIF (archived = false).
  await archivePastMatches(supabase, teamId);

  // ---- Modèle piloté par les matchs (Lots 1-3) -----------------------------
  const [matchesRes, subscriptionRes, settingsRes] = await Promise.all([
    supabase
      .from("team_matches")
      .select(
        "id, starts_at, ends_at, summary, location, match_url, kind, home_away, opponent, competition, is_anchor, source, microcycle_id",
      )
      .eq("team_id", teamId)
      .eq("archived", false)
      .gte("starts_at", winStartIso)
      .lte("starts_at", winEndIso)
      .order("starts_at", { ascending: true }),
    supabase
      .from("team_calendar_subscriptions")
      .select("id, slot, ics_url, last_synced_at, last_status, last_error, event_count")
      .eq("team_id", teamId),
    supabase
      .from("team_periodization_settings")
      .select("training_weekdays, md_scheme")
      .eq("team_id", teamId)
      .eq("season", season)
      .maybeSingle(),
  ]);
  const teamMatches = matchesRes.data ?? [];
  const subscriptions = subscriptionRes.data ?? [];
  const periodization = settingsRes.data ?? null;

  // Historique : matchs joués, détachés de l'ICS (archived = true).
  const { data: archivedMatchesData } = await supabase
    .from("team_matches")
    .select(
      "id, starts_at, ends_at, summary, location, match_url, kind, home_away, opponent, competition, is_anchor, source, microcycle_id",
    )
    .eq("team_id", teamId)
    .eq("archived", true)
    .gte("starts_at", winStartIso)
    .lte("starts_at", winEndIso)
    .order("starts_at", { ascending: false });
  const archivedMatches = archivedMatchesData ?? [];

	  const { data: sessions } = await supabase
	    .from("sessions")
	    .select("id, date, start_time, theme, duration_minutes, microcycle_id, md_offset")
	    .eq("team_id", teamId)
	    .gte("date", window.start)
	    .lte("date", window.end)
	    .order("date", { ascending: true });

	  const sessionIds = (sessions ?? []).map((s) => s.id);
	  const { data: preparationRows } = sessionIds.length
	    ? await supabase
	        .from("session_preparations")
	        .select("session_id, data")
	        .in("session_id", sessionIds)
	    : { data: [] as never[] };

	  const focusBySession = new Map<string, FocusFamily[]>();
	  for (const row of preparationRows ?? []) {
	    const raw = (row.data as { focusFamilies?: unknown } | null)?.focusFamilies;
	    const focusFamilies = Array.isArray(raw)
	      ? (raw.filter((f) =>
	          FOCUS_FAMILIES.includes(f as FocusFamily),
	        ) as FocusFamily[])
	      : [];
	    if (focusFamilies.length) focusBySession.set(row.session_id, focusFamilies);
	  }

	  const events = (sessions ?? []).map((s) => ({
	    id: s.id,
	    title: s.theme || t("session.newTitle"),
	    start: s.start_time ? `${s.date}T${s.start_time}` : s.date,
	    date: s.date,
	    durationMinutes: s.duration_minutes ?? null,
	    focusFamilies: focusBySession.get(s.id) ?? [],
	  }));

  const { data: macroRows } = await supabase
    .from("macrocycles")
    .select(
      "id, name, preseason_start_date, first_match_date, end_date, order_index",
    )
    .eq("team_id", teamId)
    .order("order_index", { ascending: true });

  const macroIds = (macroRows ?? []).map((m) => m.id);
  const { data: mesoRows } = macroIds.length
    ? await supabase
        .from("mesocycles")
        .select("id, macrocycle_id, name, kind, color, order_index")
        .in("macrocycle_id", macroIds)
        .order("order_index", { ascending: true })
    : { data: [] as never[] };

  const mesoIds = (mesoRows ?? []).map((m) => m.id);
  const { data: microRows } = mesoIds.length
    ? await supabase
        .from("microcycles")
        .select("id, mesocycle_id, start_date, week_number, theme, format, notes")
        .in("mesocycle_id", mesoIds)
        .gte("start_date", window.start)
        .lte("start_date", window.end)
        .order("start_date", { ascending: true })
    : { data: [] as never[] };

  const sessionCountByMicro = new Map<string, number>();
  for (const s of sessions ?? []) {
    if (s.microcycle_id) {
      sessionCountByMicro.set(
        s.microcycle_id,
        (sessionCountByMicro.get(s.microcycle_id) ?? 0) + 1,
      );
    }
  }

  // On ne garde que les conteneurs qui ont du contenu DANS la fenêtre saison :
  // un mésocycle sans microcycle (hors saison) et un macrocycle sans mésocycle
  // sont retirés → la vue Hebdo n'affiche que le millésime sélectionné.
  const macrocycles: Macrocycle[] = (macroRows ?? [])
    .map((macro) => ({
      id: macro.id,
      name: macro.name,
      preseason_start_date: macro.preseason_start_date,
      first_match_date: macro.first_match_date,
      end_date: macro.end_date,
      mesocycles: (mesoRows ?? [])
        .filter((m) => m.macrocycle_id === macro.id)
        .map((meso) => ({
          id: meso.id,
          name: meso.name,
          kind: meso.kind,
          color: meso.color,
          microcycles: (microRows ?? [])
            .filter((mi) => mi.mesocycle_id === meso.id)
            .map((mi) => ({
              id: mi.id,
              start_date: mi.start_date,
              week_number: mi.week_number,
              theme: mi.theme,
              format: mi.format,
              notes: mi.notes,
              session_count: sessionCountByMicro.get(mi.id) ?? 0,
            })),
        }))
        .filter((meso) => meso.microcycles.length > 0),
    }))
    .filter((macro) => macro.mesocycles.length > 0);

  // ---- Microcycles pilotés par les matchs (vue saison) ---------------------
  const { data: seasonMicroRows } = await supabase
    .from("microcycles")
    .select("id, start_date, week_number, kind, theme, target_match_id")
    .eq("team_id", teamId)
    .not("target_match_id", "is", null)
    .gte("start_date", window.start)
    .lte("start_date", window.end)
    .order("start_date", { ascending: true });

  const sessionsByMicro = new Map<
    string,
    { id: string; date: string; theme: string | null; mdOffset: number | null }[]
  >();
  for (const s of sessions ?? []) {
    if (!s.microcycle_id) continue;
    const arr = sessionsByMicro.get(s.microcycle_id) ?? [];
    arr.push({
      id: s.id,
      date: s.date,
      theme: s.theme,
      mdOffset: s.md_offset ?? null,
    });
    sessionsByMicro.set(s.microcycle_id, arr);
  }

  const seasonMicrocycles = (seasonMicroRows ?? []).map((mi) => ({
    id: mi.id,
    startDate: mi.start_date,
    weekNumber: mi.week_number,
    kind: mi.kind as string | null,
    theme: mi.theme as string | null,
    targetMatchId: mi.target_match_id as string | null,
    sessions: (sessionsByMicro.get(mi.id) ?? []).sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {team.name} — {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("seasonScope", { season })}
        </p>
      </div>

      <PlannerCalendar
        teamId={teamId}
        view={view}
        events={events}
        macrocycles={macrocycles}
        season={season}
        matches={teamMatches}
        archivedMatches={archivedMatches}
        subscriptions={subscriptions}
        periodization={periodization}
        seasonMicrocycles={seasonMicrocycles}
      />
    </div>
  );
}
