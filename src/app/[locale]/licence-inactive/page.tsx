import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Lock, Mail } from "lucide-react";
import { requireUser } from "@/lib/auth/getUser";
import { resolveCurrentMembership } from "@/lib/club/context";
import { getClubLicenseState } from "@/lib/license/queries";
import { redirect } from "next/navigation";

const CONTACT_EMAIL = "contact@grinta.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "license" });
  return { title: `${t("inactiveTitle")} · Grinta` };
}

export default async function LicenceInactivePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Must be signed in; if the club is actually accessible again, bounce back in.
  await requireUser(locale);
  const membership = await resolveCurrentMembership();
  if (membership) {
    const state = await getClubLicenseState(membership.club_id);
    if (state !== "locked") {
      redirect(`/${locale}/dashboard`);
    }
  }

  const t = await getTranslations("license");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t("inactiveTitle")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("inactiveBody")}
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Mail className="h-4 w-4" />
          {t("contactAdmin")}
        </a>
      </div>
    </div>
  );
}
