import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Archive, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";
import { resolveCurrentMembership } from "@/lib/club/context";

export default async function TeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { locale } = await params;
  const { onboarding } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("teams");
  const isOnboarding = onboarding === "1";

  // Scope to the currently selected club. Without this filter the RLS-only
  // query would return teams across every club the user belongs to, which
  // makes the ClubSwitcher useless.
  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);

  const [{ data: teams }, { count: archivedCount }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, season, age_group")
      .eq("club_id", membership.club_id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("teams")
      .select("id", { head: true, count: "exact" })
      .eq("club_id", membership.club_id)
      .not("archived_at", "is", null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {isOnboarding && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="font-medium">Club créé · {membership.club_name}</div>
          <p className="mt-1 text-emerald-800 dark:text-emerald-200">
            Une équipe par défaut <strong>Actif</strong> a été créée. Clique
            dessus pour la renommer ou ajouter d&apos;autres équipes.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <div className="flex items-center gap-2">
          {(archivedCount ?? 0) > 0 && (
            <Link href="/teams/archived">
              <Button variant="ghost" size="sm">
                <Archive className="h-4 w-4" />
                Archivées ({archivedCount})
              </Button>
            </Link>
          )}
          <Link href="/teams/new">
            <Button>
              <Plus className="h-4 w-4" />
              {t("new")}
            </Button>
          </Link>
        </div>
      </div>

      {!teams || teams.length === 0 ? (
        <div className="border-y border-[var(--club-line)] bg-white/70 px-4 py-8">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
        </div>
      ) : (
        <div className="overflow-hidden border-y border-[var(--club-line)] bg-white/[0.72]">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className="group grid gap-3 border-b border-zinc-100 px-4 py-4 transition last:border-b-0 hover:bg-[var(--club-primary-soft)] md:grid-cols-[1fr_180px_44px] md:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-9 w-1 rounded-full bg-[var(--club-primary)]" />
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {team.name}
                  </div>
                  <div className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {team.age_group || "Catégorie non définie"}
                  </div>
                </div>
              </div>
              <div className="text-sm text-zinc-500 md:text-right">
                {team.season || "Saison non définie"}
              </div>
              <div className="hidden justify-end md:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition group-hover:bg-white group-hover:text-[var(--club-primary)]">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
