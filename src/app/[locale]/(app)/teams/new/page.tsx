import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { NewTeamForm } from "@/components/teams/NewTeamForm";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";

export default async function NewTeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("teams");
  const season = await resolveCurrentSeasonLabel();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("new")}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("seasonScope", { season })}
        </p>
      </div>
      <Card>
        <NewTeamForm />
      </Card>
    </div>
  );
}
