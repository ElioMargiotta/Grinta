import { setRequestLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { ConfirmedRedirect } from "@/components/auth/ConfirmedRedirect";

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app");

  return (
    <div className="flex min-h-screen flex-1 items-start justify-center bg-zinc-50 px-4 py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/documents/svg/grinta-icon.svg"
            alt={t("name")}
            width={64}
            height={64}
            priority
            className="mb-3 h-16 w-16"
          />
          <Image
            src="/documents/svg/grinta-wordmark.svg"
            alt={t("name")}
            width={192}
            height={192}
            priority
            className="h-12 w-auto"
          />
          <p className="mt-1 text-sm text-zinc-600">{t("tagline")}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <ConfirmedRedirect />
        </div>
      </div>
    </div>
  );
}
