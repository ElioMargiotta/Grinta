import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getClubGroupDetail, listAvailableClubGroupMembers } from "@/lib/admin/queries";
import { ClubGroupForm } from "@/components/admin/ClubGroupForm";
import { InviteGroupResponsibleForm } from "@/components/admin/InviteGroupResponsibleForm";
import { ClubGroupDangerZone } from "@/components/admin/ClubGroupDangerZone";
import { ClubLogos } from "@/components/club/ClubLogos";

export default async function AdminClubGroupDetailPage({
  params,
}: {
  params: Promise<{ locale: string; groupId: string }>;
}) {
  const { locale, groupId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const group = await getClubGroupDetail(groupId);
  if (!group) notFound();

  const availableClubs = await listAvailableClubGroupMembers(
    groupId,
    group.category,
    group.subcategory,
  );
  const clubs = availableClubs
    .filter((c) => !c.archived_at)
    .map((c) => ({ id: c.club_id, name: c.name }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/regroupements"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("regroupements.title")}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {group.name}
        </h1>
        {group.category && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {t(`regroupements.categoryLabels.${group.category}`)}
            {group.subcategory
              ? ` · ${t(`regroupements.subcategoryLabels.${group.subcategory}`)}`
              : ""}
          </span>
        )}
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t("regroupements.members")}
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {group.members.map((member) => (
            <li key={member.club_id}>
              <Link
                href={`/admin/clubs/${member.club_id}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
              >
                <ClubLogos
                  logos={member.logos.slice(0, 1)}
                  imgClassName="h-7 w-7 rounded-md ring-1 ring-zinc-200 dark:ring-zinc-700"
                  max={1}
                />
                <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {member.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <ClubGroupForm
          locale={locale}
          clubs={clubs}
          initial={{
            groupId: group.id,
            name: group.name,
            category: group.category,
            subcategory: group.subcategory,
            memberIds: group.members.map((m) => m.club_id),
            maxTeams: group.max_teams,
            maxPlayers: group.max_players,
            maxStaff: group.max_staff,
          }}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t("regroupements.responsibleTitle")}
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {t("regroupements.responsibleHint")}
        </p>
        <p className="mt-1 mb-4 text-xs text-zinc-400 dark:text-zinc-500">
          {t("regroupements.ownersInheritedHint")}
        </p>
        <InviteGroupResponsibleForm groupId={group.id} locale={locale} />
      </section>

      <div className="mt-6">
        <ClubGroupDangerZone
          groupId={group.id}
          groupName={group.name}
          locale={locale}
          usage={{ teams: group.teams, players: group.players, staff: group.staff }}
        />
      </div>
    </div>
  );
}
