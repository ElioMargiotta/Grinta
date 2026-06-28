import { setRequestLocale, getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  // The /auth/callback route exchanges the recovery code for a session before
  // redirecting here, so a valid recovery flow lands with an authenticated
  // user. No user (or an `?error=` from the callback) means a stale/invalid
  // link or a direct visit — show a recoverable dead-end instead of the form.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (error || !user) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-5 text-center">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {t("resetInvalidTitle")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("resetInvalidBody")}</p>
          </div>
          <Link href="/forgot-password" className={buttonVariants()}>
            {t("resetRequestAgain")}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
