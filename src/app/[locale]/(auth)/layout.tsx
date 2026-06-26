import { setRequestLocale, getTranslations } from "next-intl/server";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { GrintaLogoIcon, GrintaLogoType } from "@/components/landing/BrandSeal";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app");

  return (
    <div className="relative flex min-h-screen flex-1 items-start justify-center bg-muted px-4 py-10 sm:items-center sm:py-16">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <LocaleSwitcher variant="subtle" />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <GrintaLogoIcon size={64} title={t("name")} className="mb-3" />
          <GrintaLogoType height={48} title={t("name")} className="w-auto max-w-[200px]" />
          <p className="mt-2 text-sm text-muted-foreground">{t("tagline")}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <AuthTabs />
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
