import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignupForm } from "@/components/auth/SignupForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { Link } from "@/i18n/navigation";

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">{t("signupTitle")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("signupSubtitle")}</p>
      </div>
      <OAuthButtons next={next} />
      <SignupForm />
      <p className="text-center text-sm text-zinc-600">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-zinc-900 underline">
          {t("switchToLogin")}
        </Link>
      </p>
    </div>
  );
}
