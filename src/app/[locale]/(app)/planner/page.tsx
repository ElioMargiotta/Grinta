import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";
import { resolveCurrentMembership } from "@/lib/club/context";

export default async function PlannerIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("planner");

  // Scope to the currently selected club (see TeamsPage for rationale).
  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, season, age_group")
    .eq("club_id", membership.club_id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {t("title")}
      </h1>

      {!teams || teams.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("noTeams")}</p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("pickTeam")}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Link key={team.id} href={`/planner/${team.id}`}>
                <Card className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {team.name}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {[team.age_group, team.season].filter(Boolean).join(" · ") || "—"}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
