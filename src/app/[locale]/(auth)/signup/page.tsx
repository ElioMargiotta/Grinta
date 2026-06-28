import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignupForm } from "@/components/auth/SignupForm";
import { Link } from "@/i18n/navigation";

export default async function SignupPage({
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
        <h1 className="text-xl font-semibold text-foreground">{t("signupTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("signupSubtitle")}</p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          {t("switchToLogin")}
        </Link>
      </p>
    </div>
  );
}
