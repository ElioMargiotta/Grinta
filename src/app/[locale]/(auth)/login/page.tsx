import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { AuthSplit } from "@/components/auth/AuthSplit";
import { AuthTabs } from "@/components/auth/AuthTabs";
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
  const tApp = await getTranslations("app");

  const aside = (
    <div className="flex flex-col gap-5">
      <p className="eyebrow-mono">{t("authAsideEyebrow")}</p>
      <p className="h-display text-[clamp(1.6rem,4vw,2.5rem)] font-semibold">
        {t("authAsidePitch")}
      </p>
    </div>
  );

  return (
    <AuthSplit name={tApp("name")} tagline={t("authAsideTagline")} aside={aside}>
      <div className="flex flex-col gap-6">
        <AuthTabs />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
            {t("loginTitle")}
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-2)]">{t("loginSubtitle")}</p>
        </div>

        <LoginForm />

        <OAuthButtons next={next} variant="icons" />

        <div className="flex flex-col gap-2 text-center text-sm text-[var(--ink-2)]">
          <Link
            href="/forgot-password"
            className="font-medium text-[var(--ink)] underline"
          >
            {t("forgotPasswordLink")}
          </Link>
          <p>
            {t("noAccount")}{" "}
            <Link href="/signup" className="font-medium text-[var(--ink)] underline">
              {t("switchToSignup")}
            </Link>
          </p>
        </div>
      </div>
    </AuthSplit>
  );
}
