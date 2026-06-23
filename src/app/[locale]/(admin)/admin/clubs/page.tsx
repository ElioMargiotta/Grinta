import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { listClubsOverview } from "@/lib/admin/queries";
import { StateBadge, formatDate } from "@/components/admin/ui";

export default async function AdminClubsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const clubs = await listClubsOverview();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("clubs.title")} <span className="text-zinc-400">({clubs.length})</span>
        </h1>
        <Link
          href="/admin/clubs/new"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Plus className="h-4 w-4" />
          {t("clubs.new")}
        </Link>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t("clubs.name")}</th>
              <th className="px-4 py-2.5 font-medium">{t("clubs.state")}</th>
              <th className="px-4 py-2.5 font-medium">{t("clubs.usage")}</th>
              <th className="px-4 py-2.5 font-medium">{t("license.endsAt")}</th>
              <th className="px-4 py-2.5 font-medium">{t("clubs.created")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
            {clubs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                  {t("clubs.empty")}
                </td>
              </tr>
            )}
            {clubs.map((c) => (
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
                  {c.auto_renew ? t("license.autoRenewShort") : formatDate(c.ends_at)}
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
