import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { BdnsExportPanel } from "@/components/planner/BdnsExportPanel";
import { requireMembership } from "@/lib/auth/getUser";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";
import { seasonWindow } from "@/lib/planner/seasons";

export default async function BdnsExportPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireMembership(locale);
  const t = await getTranslations("bdns");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) notFound();

  const season = await resolveCurrentSeasonLabel();
  const window = seasonWindow(season);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/${locale}/planner/${teamId}`}
          className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("backToPlanner")}
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")} — {team.name}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
      </div>

      <Card>
        <BdnsExportPanel
          teamId={teamId}
          defaultStart={window.start}
          defaultEnd={window.end}
        />
      </Card>
    </div>
  );
}
