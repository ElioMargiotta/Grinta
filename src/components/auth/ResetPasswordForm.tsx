"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useRouter } from "@/i18n/navigation";
import { updatePasswordAction } from "@/app/[locale]/reset-password/actions";

const REDIRECT_SECONDS = 4;

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => router.replace("/login"), REDIRECT_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [done, router]);

  if (done) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {t("resetSuccessTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("resetSuccessBody")}</p>
        </div>
        <p className="text-sm text-muted-foreground">{t("resetSuccessRedirect")}</p>
        <Button type="button" onClick={() => router.replace("/login")}>
          {t("resetSuccessCta")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("resetTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("resetSubtitle")}</p>
      </div>

      <form
        className="flex flex-col gap-5"
        action={(formData) => {
          setError(null);
          const password = String(formData.get("password") ?? "");
          const confirm = String(formData.get("confirmPassword") ?? "");
          if (password.length < 6) {
            setError(t("passwordTooShort"));
            return;
          }
          if (password !== confirm) {
            setError(t("passwordMismatch"));
            return;
          }
          startTransition(async () => {
            const result = await updatePasswordAction(formData);
            if (result?.success) setDone(true);
            else if (result?.errorCode === "passwordTooShort")
              setError(t("passwordTooShort"));
            else if (result?.errorCode === "noSession")
              setError(t("resetInvalidBody"));
            else if (result?.error) setError(result.error);
            else setError(t("genericError"));
          });
        }}
      >
        <AuthField
          label={t("newPassword")}
          htmlFor="password"
          help={t("passwordHelpReset")}
          required
        >
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder={t("passwordPlaceholder")}
          />
        </AuthField>

        <AuthField label={t("confirmPassword")} htmlFor="confirmPassword" required>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder={t("passwordPlaceholder")}
          />
        </AuthField>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          type="submit"
          loading={isPending}
          loadingLabel={t("resetSubmitting")}
          className="w-full"
        >
          {t("resetSubmit")}
        </Button>
      </form>
    </div>
  );
}
