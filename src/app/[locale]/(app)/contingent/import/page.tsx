import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { ImportClubCornerWizard } from "@/components/contingent/ImportClubCornerWizard";
import { requireMembership } from "@/lib/auth/getUser";

export default async function ImportContingentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireMembership(locale);
  const t = await getTranslations("contingent");

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
        <ImportClubCornerWizard />
      </Card>
    </div>
  );
}
