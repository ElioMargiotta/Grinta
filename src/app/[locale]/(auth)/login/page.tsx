import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { Link } from "@/i18n/navigation";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">{t("loginTitle")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("loginSubtitle")}</p>
      </div>
      <LoginForm />
      <div className="flex flex-col gap-2 text-center text-sm text-zinc-600">
        <Link
          href="/forgot-password"
          className="font-medium text-zinc-900 underline"
        >
          {t("forgotPasswordLink")}
        </Link>
        <p>
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-zinc-900 underline">
            {t("switchToSignup")}
          </Link>
        </p>
      </div>
    </div>
  );
}
