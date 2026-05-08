import { ArrowUpRight, CalendarDays, Dumbbell, Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireUser(locale);
  const t = await getTranslations("dashboard");

  const [{ data: profile }, { count: teamsCount }, { count: exercisesCount }, { data: nextSession }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase.from("teams").select("*", { count: "exact", head: true }),
      supabase.from("exercises").select("*", { count: "exact", head: true }),
      supabase
        .from("sessions")
        .select("id, date, theme, team_id, teams(name)")
        .gte("date", new Date().toISOString().slice(0, 10))
        .order("date", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  const name = profile?.full_name?.trim() || user.email || "";

  const stats = [
    {
      label: t("teamsCard"),
      value: teamsCount ?? 0,
      href: "/teams",
      icon: Users,
    },
    {
      label: t("exercisesCard"),
      value: exercisesCount ?? 0,
      href: "/exercises",
      icon: Dumbbell,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          {t("welcome", { name }).toString().split(",")[0]}
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("welcome", { name })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, href, icon: Icon }) => (
          <Link key={label} href={href} className="group">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-zinc-300 transition group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
              </div>
              <div className="mt-6">
                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {label}
                </div>
                <div className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {value}
                </div>
              </div>
            </div>
          </Link>
        ))}

        <div className="flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-900 to-zinc-700 p-5 text-white shadow-sm dark:border-zinc-800">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
              <CalendarDays className="h-5 w-5" />
            </div>
            {nextSession && (
              <Link
                href={`/planner/${nextSession.team_id}/sessions/${nextSession.id}/preparation`}
                className="text-xs font-medium text-white/80 underline-offset-2 hover:text-white hover:underline"
              >
                Open
              </Link>
            )}
          </div>
          <div className="mt-6">
            <div className="text-sm font-medium text-white/70">
              {t("nextSession")}
            </div>
            {nextSession ? (
              <div className="mt-1">
                <div className="text-2xl font-semibold tracking-tight">
                  {nextSession.date}
                </div>
                <div className="mt-0.5 text-sm text-white/80">
                  {nextSession.theme || "Untitled session"}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-white/70">
                {t("noNextSession")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
