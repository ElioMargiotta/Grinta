import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/getUser";
import { OnboardingClubForm } from "@/components/onboarding/OnboardingClubForm";

export default async function CreateClubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("onboarding.clubPage");
  await requireUser(locale);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("description")}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <OnboardingClubForm />
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {t("pricing")}
      </p>
    </div>
  );
}
