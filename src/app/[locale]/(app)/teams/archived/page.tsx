import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";
import { resolveCurrentMembership } from "@/lib/club/context";
import { ArchivedTeamCard } from "@/components/teams/ArchivedTeamCard";

export default async function ArchivedTeamsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireUser(locale);

  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, season, age_group, archived_at")
    .eq("club_id", membership.club_id)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  const rows = teams ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <Link
          href="/teams"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour aux équipes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Équipes archivées
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Une équipe archivée ne compte plus dans ta facturation à partir du
          prochain cycle. Tu peux la <strong>restaurer</strong> à tout moment,
          ou la <strong>supprimer définitivement</strong> (irréversible).
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Aucune équipe archivée.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((team) => (
            <ArchivedTeamCard
              key={team.id}
              team={team as Parameters<typeof ArchivedTeamCard>[0]["team"]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
