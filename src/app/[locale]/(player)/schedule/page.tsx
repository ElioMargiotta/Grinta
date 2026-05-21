import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { requirePersona } from "@/lib/auth/getUser";

type SessionRow = {
  id: string;
  team_id: string | null;
  date: string;
  start_time: string | null;
  duration_minutes: number | null;
  theme: string | null;
  teams: { name: string } | null;
};

function formatDate(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function PlayerSchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, persona } = await requirePersona(locale, "player");
  const t = await getTranslations("playerSchedule");
  const currentLocale = await getLocale();

  if (!persona.playerId) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
        </Card>
      </div>
    );
  }

  // Player team ids (any season). RLS sessions_player_read filters on the join,
  // so this list scope is just to avoid a redundant subselect in the SQL.
  const { data: assignments } = await supabase
    .from("player_team_assignments")
    .select("team_id")
    .eq("player_id", persona.playerId);
  const teamIds = Array.from(new Set((assignments ?? []).map((a) => a.team_id as string)));

  if (teamIds.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
        </Card>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("sessions")
    .select(`id, team_id, date, start_time, duration_minutes, theme, teams!inner(name)`)
    .in("team_id", teamIds)
    .gte("date", today)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .limit(50)
    .returns<SessionRow[]>();

  const sessions = data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {t("title")}
      </h1>

      {sessions.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("emptyUpcoming")}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {s.theme ?? t("untitled")}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {s.teams?.name ?? "—"}
                  </div>
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-300">
                  <div>{formatDate(s.date, currentLocale)}</div>
                  {s.start_time && (
                    <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                      {s.start_time.slice(0, 5)}
                      {s.duration_minutes ? ` · ${s.duration_minutes}'` : ""}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
