import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("welcome", { name })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/teams">
          <Card className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">{t("teamsCard")}</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
              {teamsCount ?? 0}
            </div>
          </Card>
        </Link>
        <Link href="/exercises">
          <Card className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">{t("exercisesCard")}</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
              {exercisesCount ?? 0}
            </div>
          </Card>
        </Link>
        <Card>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">{t("nextSession")}</div>
          {nextSession ? (
            <div className="mt-2">
              <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {nextSession.date}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {nextSession.theme || "—"}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t("noNextSession")}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
