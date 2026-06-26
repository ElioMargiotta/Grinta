"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { loginAction } from "@/app/[locale]/(auth)/login/actions";

const inputClass =
  "h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15";

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-5"
      action={(formData) => {
        setError(null);
        formData.set("locale", locale);
        startTransition(async () => {
          const result = await loginAction(formData);
          if (result?.errorCode) setError(t(result.errorCode));
          else if (result?.error) setError(result.error);
        });
      }}
    >
      <AuthField label={t("email")} htmlFor="email" help={t("emailHelp")} required>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={t("emailPlaceholder")}
          className={inputClass}
        />
      </AuthField>

      <AuthField
        label={t("password")}
        htmlFor="password"
        help={t("passwordHelpLogin")}
        required
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
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
        loadingLabel={t("submittingLogin")}
        className="w-full"
      >
        {t("submitLogin")}
      </Button>
    </form>
  );
}
