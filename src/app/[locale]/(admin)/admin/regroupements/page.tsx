import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { listClubGroups } from "@/lib/admin/queries";
import { ClubLogos } from "@/components/club/ClubLogos";

export default async function AdminClubGroupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const all = await listClubGroups();
  const groups = all.filter((g) => !g.archived_at);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("regroupements.title")} <span className="text-zinc-400">({groups.length})</span>
        </h1>
        <Link
          href="/admin/regroupements/new"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Plus className="h-4 w-4" />
          {t("regroupements.new")}
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("regroupements.subtitle")}</p>

      {groups.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
          <Users className="h-6 w-6 text-zinc-400" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("regroupements.empty")}</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/admin/regroupements/${g.id}`}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {g.name}
                    </span>
                    {g.category && (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {t(`regroupements.categoryLabels.${g.category}`)}
                        {g.subcategory
                          ? ` · ${t(`regroupements.subcategoryLabels.${g.subcategory}`)}`
                          : ""}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-zinc-400">
                    {t("regroupements.memberCount", { count: g.members.length })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ClubLogos
                    logos={g.members.flatMap((m) => m.logos.slice(0, 1))}
                    imgClassName="h-7 w-7 rounded-md ring-1 ring-zinc-200 dark:ring-zinc-700"
                    max={6}
                  />
                  <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {g.members.map((m) => m.name).join(" · ")}
                  </span>
                </div>
                <div className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  {g.teams}
                  {g.max_teams !== null ? `/${g.max_teams}` : ""} équipes · {g.players}
                  {g.max_players !== null ? `/${g.max_players}` : ""} joueurs · {g.staff}
                  {g.max_staff !== null ? `/${g.max_staff}` : ""} staff
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
