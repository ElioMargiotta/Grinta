import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PlannerCalendar } from "@/components/planner/PlannerCalendar";
import { requireUser } from "@/lib/auth/getUser";

type View = "year" | "month" | "week" | "day";

const VALID_VIEWS: View[] = ["year", "month", "week", "day"];

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

  const view: View = (VALID_VIEWS as string[]).includes(viewParam ?? "")
    ? (viewParam as View)
    : "month";

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .single();
  if (!team) notFound();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, date, start_time, theme")
    .eq("team_id", teamId)
    .order("date", { ascending: true });

  const events = (sessions ?? []).map((s) => ({
    id: s.id,
    title: s.theme || t("session.newTitle"),
    start: s.start_time ? `${s.date}T${s.start_time}` : s.date,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {team.name} — {t("title")}
        </h1>
      </div>
      <PlannerCalendar teamId={teamId} view={view} events={events} />
    </div>
  );
}
