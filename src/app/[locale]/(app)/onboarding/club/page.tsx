import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Building2, Mail } from "lucide-react";
import { requireUser, isPlatformAdmin } from "@/lib/auth/getUser";

const CONTACT_EMAIL = "contact@grinta.app";

export default async function CreateClubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);

  // Clubs are now provisioned by a platform operator (quote-based licensing),
  // not self-served. Operators land on the admin console instead.
  if (await isPlatformAdmin()) {
    redirect(`/${locale}/admin`);
  }

  const t = await getTranslations("onboarding.clubPage");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("noAccessTitle")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("noAccessBody")}
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Mail className="h-4 w-4" />
          {t("contactSales")}
        </a>
      </div>
    </div>
  );
}
