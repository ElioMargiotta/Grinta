import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Building2, Mail } from "lucide-react";
import { requireUser, isPlatformAdmin } from "@/lib/auth/getUser";
import { buttonVariants } from "@/components/ui/Button";

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
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("noAccessTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("noAccessBody")}
        </p>
        <a href={`mailto:${CONTACT_EMAIL}`} className={`${buttonVariants()} mt-6`}>
          <Mail className="h-4 w-4" />
          {t("contactSales")}
        </a>
      </div>
    </div>
  );
}
