"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  TurnstileWidget,
  type TurnstileHandle,
} from "@/components/auth/TurnstileWidget";
import { loginAction } from "@/app/[locale]/(auth)/login/actions";

const inputClass =
  "h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15";

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const turnstileRef = useRef<TurnstileHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);

        const form = event.currentTarget;
        if (!form.reportValidity()) return;

        startTransition(async () => {
          try {
            const captchaToken = await turnstileRef.current?.execute();
            const formData = new FormData(form);
            formData.set("locale", locale);
            if (captchaToken) {
              formData.set("cf-turnstile-response", captchaToken);
            }
            const result = await loginAction(formData);
            if (result?.errorCode) setError(t(result.errorCode));
            else if (result?.error) setError(result.error);
          } catch {
            setError(t("genericError"));
          } finally {
            turnstileRef.current?.reset();
          }
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

      <TurnstileWidget ref={turnstileRef} />

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
