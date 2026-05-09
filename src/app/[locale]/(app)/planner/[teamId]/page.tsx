import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  PlannerCalendar,
  type PlannerView,
} from "@/components/planner/PlannerCalendar";
import { PlannerSetupWizard } from "@/components/planner/PlannerSetupWizard";
import { type Macrocycle } from "@/components/planner/PlannerTourView";
import { FOCUS_FAMILIES, type FocusFamily } from "@/components/sheet/types";
import { requireUser } from "@/lib/auth/getUser";

const VALID_VIEWS: PlannerView[] = ["tour", "weekly"];

export default async function PlannerTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; teamId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale, teamId } = await params;
  const { view: viewParam } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("planner");

  const view: PlannerView = (VALID_VIEWS as string[]).includes(viewParam ?? "")
    ? (viewParam as PlannerView)
    : "weekly";

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, season")
    .eq("id", teamId)
    .single();
  if (!team) notFound();

	  const { data: sessions } = await supabase
	    .from("sessions")
	    .select("id, date, start_time, theme, duration_minutes, microcycle_id")
	    .eq("team_id", teamId)
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

  const macrocycles: Macrocycle[] = (macroRows ?? []).map((macro) => ({
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
      })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {team.name} — {t("title")}
        </h1>
      </div>

      {macrocycles.length === 0 ? (
        <PlannerSetupWizard teamId={teamId} defaultName={team.name} />
      ) : (
        <PlannerCalendar
          teamId={teamId}
          view={view}
          events={events}
          macrocycles={macrocycles}
          teamName={team.name}
          season={team.season ?? null}
        />
      )}
    </div>
  );
}
