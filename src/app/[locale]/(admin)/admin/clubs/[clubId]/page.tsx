import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getClubDetail } from "@/lib/admin/queries";
import { LicenseForm } from "@/components/admin/LicenseForm";
import { StateBadge, UsageMeter, formatDate } from "@/components/admin/ui";

export default async function AdminClubDetailPage({
  params,
}: {
  params: Promise<{ locale: string; clubId: string }>;
}) {
  const { locale, clubId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const detail = await getClubDetail(clubId);
  if (!detail) notFound();

  const lic = detail.license;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/clubs"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("clubs.title")}
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {detail.name}
        </h1>
        {lic && <StateBadge state={lic.state} label={t(`state.${lic.state}`)} />}
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {t("clubs.created")}: {formatDate(detail.created_at)}
      </p>

      {/* Usage */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <UsageMeter used={detail.usage.teams} max={lic?.max_teams ?? null} label={t("clubs.teams")} />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <UsageMeter used={detail.usage.players} max={lic?.max_players ?? null} label={t("clubs.players")} />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <UsageMeter used={detail.usage.staff} max={lic?.max_staff ?? null} label={t("clubs.staff")} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* License edit */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t("license.title")}
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            {lic ? (
              <LicenseForm
                clubId={clubId}
                locale={locale}
                values={{
                  status: lic.status,
                  auto_renew: lic.auto_renew,
                  ends_at: lic.ends_at,
                  quote_reference: lic.quote_reference,
                  notes: lic.notes,
                  max_teams: lic.max_teams,
                  max_players: lic.max_players,
                  max_staff: lic.max_staff,
                }}
              />
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("license.none")}</p>
            )}
          </div>
        </section>

        {/* Members + events */}
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t("clubs.members")} <span className="text-zinc-400">({detail.members.length})</span>
            </h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {detail.members.length === 0 ? (
                <p className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                  {t("clubs.noMembers")}
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {detail.members.map((m) => (
                    <li key={m.user_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-zinc-900 dark:text-zinc-100">{m.full_name ?? "—"}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{m.role_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t("license.history")}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {detail.events.length === 0 ? (
                <p className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                  {t("license.noHistory")}
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {detail.events.map((e) => (
                    <li key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {e.event_type}
                      </span>
                      <span className="text-xs text-zinc-400">{formatDate(e.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
