import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CreateClubForm } from "@/components/admin/CreateClubForm";
import { listClubDirectory } from "@/lib/admin/queries";

export default async function AdminNewClubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const directory = await listClubDirectory();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/clubs"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("clubs.title")}
      </Link>
      <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {t("clubs.new")}
      </h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        {t("clubs.newSubtitle")}
      </p>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <CreateClubForm locale={locale} directory={directory} />
      </div>
    </div>
  );
}
