"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Shield, UserCircle, Users } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { signupAction } from "@/app/[locale]/(auth)/signup/actions";

type PersonaChoice = "staff" | "player" | "dual";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15";

export function SignupForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [persona, setPersona] = useState<PersonaChoice>("staff");
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

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">
          {t("personaChoiceLabel")}
        </legend>
        <p className="text-xs text-muted-foreground">{t("personaChoiceHelp")}</p>
        <input type="hidden" name="personaPreference" value={persona} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              { value: "staff", icon: Shield, labelKey: "personaChoiceStaff" },
              { value: "player", icon: UserCircle, labelKey: "personaChoicePlayer" },
              { value: "dual", icon: Users, labelKey: "personaChoiceDual" },
            ] as const
          ).map(({ value, icon: Icon, labelKey }) => {
            const active = persona === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPersona(value)}
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-input"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
