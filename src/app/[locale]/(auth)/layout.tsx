import { setRequestLocale, getTranslations } from "next-intl/server";
import { AuthTabs } from "@/components/auth/AuthTabs";

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
    <div className="flex min-h-screen flex-1 items-start justify-center bg-zinc-50 px-4 py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {t("name")}
          </div>
          <p className="mt-1 text-sm text-zinc-600">{t("tagline")}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <AuthTabs />
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
