import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { listTenantClubsOverview, computeDashboardStats } from "@/lib/admin/queries";
import { StatCard, StateBadge, formatDate } from "@/components/admin/ui";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const clubs = (await listTenantClubsOverview()).filter((c) => !c.archived_at);
  const stats = computeDashboardStats(clubs);
  const recent = clubs.slice(0, 8);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("dashboard.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <Link
          href="/admin/clubs/new"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Plus className="h-4 w-4" />
          {t("clubs.new")}
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("dashboard.totalClubs")} value={stats.totalClubs} />
        <StatCard label={t("dashboard.active")} value={stats.active} />
        <StatCard label={t("dashboard.grace")} value={stats.grace} />
        <StatCard label={t("dashboard.locked")} value={stats.locked} />
        <StatCard label={t("dashboard.expiringSoon")} value={stats.expiringSoon} />
        <StatCard label={t("dashboard.totalTeams")} value={stats.totalTeams} />
        <StatCard label={t("dashboard.totalPlayers")} value={stats.totalPlayers} />
        <StatCard label={t("dashboard.totalStaff")} value={stats.totalStaff} />
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {t("dashboard.recentClubs")}
      </h2>
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t("clubs.name")}</th>
              <th className="px-4 py-2.5 font-medium">{t("clubs.state")}</th>
              <th className="px-4 py-2.5 font-medium">{t("clubs.usage")}</th>
              <th className="px-4 py-2.5 font-medium">{t("clubs.created")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
            {recent.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                  {t("clubs.empty")}
                </td>
              </tr>
            )}
            {recent.map((c) => (
              <tr key={c.club_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/clubs/${c.club_id}`}
                    className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <StateBadge state={c.state} label={t(`state.${c.state}`)} />
                </td>
                <td className="px-4 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-300">
                  {c.teams}
                  {c.max_teams !== null ? `/${c.max_teams}` : ""} · {c.players}
                  {c.max_players !== null ? `/${c.max_players}` : ""} · {c.staff}
                  {c.max_staff !== null ? `/${c.max_staff}` : ""}
                </td>
                <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-400">
                  {formatDate(c.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
