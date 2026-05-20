import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { ImportClubCornerWizard } from "@/components/contingent/ImportClubCornerWizard";
import { requireMembership } from "@/lib/auth/getUser";
import { listClubTeams } from "@/lib/contingent/teams";

export default async function ImportContingentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ teamId?: string }>;
}) {
  const { locale } = await params;
  const { teamId } = await searchParams;
  setRequestLocale(locale);
  const { membership } = await requireMembership(locale);
  const t = await getTranslations("contingent");
  const teams = await listClubTeams(membership.club_id);
  // ?teamId=... vient typiquement du bouton "Importer ClubCorner" depuis une
  // équipe (#39) — on pré-sélectionne l'équipe cible dans le wizard.
  const defaultTargetTeamId =
    teamId && teams.some((tm) => tm.id === teamId) ? teamId : undefined;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/contingent"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("importTitle")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("importSubtitle")}
        </p>
      </div>

      <Card>
        <ImportClubCornerWizard
          teams={teams}
          defaultTargetTeamId={defaultTargetTeamId}
        />
      </Card>
    </div>
  );
}
