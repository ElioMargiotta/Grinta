"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import type { PersonaChoice } from "@/components/auth/PersonaPicker";
import { isStrongPassword } from "@/lib/auth/password";
import { signupAction } from "@/app/[locale]/(auth)/signup/actions";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--brand)_22%,transparent)]";

export function SignupForm({ persona }: { persona: PersonaChoice }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  if (confirmed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <h2 className="text-base font-semibold text-emerald-900">
          {t("checkEmailTitle")}
        </h2>
        <p className="text-sm text-emerald-800">{t("checkEmail")}</p>
      </div>
    );
  }

  const passwordOk = password === "" || isStrongPassword(password);

  return (
    <form
      className="flex flex-col gap-5"
      action={(formData) => {
        setError(null);
        formData.set("locale", locale);
        formData.set("personaPreference", persona);
        startTransition(async () => {
          const result = await signupAction(formData);
          if (result?.errorCode) setError(t(result.errorCode));
          else if (result?.error) setError(result.error);
          else if (result?.needsConfirmation) setConfirmed(true);
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AuthField label={t("firstName")} htmlFor="firstName" required>
          <input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            required
            placeholder={t("firstNamePlaceholder")}
            className={inputClass}
          />
        </AuthField>
        <AuthField label={t("lastName")} htmlFor="lastName" required>
          <input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            required
            placeholder={t("lastNamePlaceholder")}
            className={inputClass}
          />
        </AuthField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AuthField label={t("birthDate")} htmlFor="birthDate">
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            autoComplete="bday"
            className={inputClass}
          />
        </AuthField>
        <AuthField label={t("phone")} htmlFor="phone">
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder={t("phonePlaceholder")}
            className={inputClass}
          />
        </AuthField>
      </div>

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
        help={t("passwordPolicyHint")}
        required
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordPlaceholder")}
        />
      </AuthField>
      {!passwordOk && (
        <p className="-mt-3 text-xs text-red-600">{t("weakPassword")}</p>
      )}

      <TurnstileWidget />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Button
        type="submit"
        loading={isPending}
        loadingLabel={t("submittingSignup")}
        disabled={isPending || !passwordOk}
        className="w-full"
      >
        {t("submitSignup")}
      </Button>
    </form>
  );
}
