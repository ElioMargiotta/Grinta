import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { Link } from "@/i18n/navigation";

export default async function LoginPage({
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
        <h1 className="text-xl font-semibold text-foreground">{t("loginTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("loginSubtitle")}</p>
      </div>
      <OAuthButtons next={next} />
      <LoginForm />
      <div className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
        <Link
          href="/forgot-password"
          className="font-medium text-foreground underline"
        >
          {t("forgotPasswordLink")}
        </Link>
        <p>
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-foreground underline">
            {t("switchToSignup")}
          </Link>
        </p>
      </div>
    </div>
  );
}
