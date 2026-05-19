"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { signupAction } from "@/app/[locale]/(auth)/signup/actions";

const inputClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";

export function SignupForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
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

  return (
    <form
      className="flex flex-col gap-5"
      action={(formData) => {
        setError(null);
        formData.set("locale", locale);
        startTransition(async () => {
          const result = await signupAction(formData);
          if (result?.errorCode === "emailExists")
            setError(t("emailAlreadyExists"));
          else if (result?.error) setError(result.error);
          else if (result?.needsConfirmation) setConfirmed(true);
        });
      }}
    >
      <AuthField
        label={t("fullName")}
        htmlFor="fullName"
        help={t("fullNameHelp")}
        required
      >
        <input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          placeholder={t("namePlaceholder")}
          className={inputClass}
        />
      </AuthField>

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
        help={t("passwordHelpSignup")}
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

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Button
        type="submit"
        loading={isPending}
        loadingLabel={t("submittingSignup")}
        className="w-full"
      >
        {t("submitSignup")}
      </Button>
    </form>
  );
}
