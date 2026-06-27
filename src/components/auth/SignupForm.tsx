"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Shield, UserCircle, Users, Check, X, Loader2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { createClient } from "@/lib/supabase/client";
import { signupAction } from "@/app/[locale]/(auth)/signup/actions";

type PersonaChoice = "staff" | "player" | "parent";

const inputClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";

const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/;

function isStrongPassword(pw: string): boolean {
  return (
    pw.length >= 12 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /\d/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

export function SignupForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const supabase = useMemo(() => createClient(), []);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [persona, setPersona] = useState<PersonaChoice>("staff");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  // Résultat asynchrone du check de dispo uniquement ; les états "idle"/"invalid"
  // sont dérivés (évite un setState synchrone dans l'effet).
  const [checkState, setCheckState] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [isPending, startTransition] = useTransition();

  const normalizedUsername = username.trim().toLowerCase();
  const formatValid = USERNAME_RE.test(normalizedUsername);
  const usernameState: "idle" | "checking" | "available" | "taken" | "invalid" =
    !normalizedUsername ? "idle" : !formatValid ? "invalid" : checkState;

  // Vérification de disponibilité du handle (debounce 400 ms), façon LinkedIn :
  // le vrai nom s'affiche, le username doit être unique pour retrouver/inviter.
  useEffect(() => {
    if (!normalizedUsername || !formatValid) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setCheckState("checking");
      const { data } = await supabase.rpc("is_username_available", {
        p_username: normalizedUsername,
      });
      if (!cancelled) setCheckState(data === false ? "taken" : "available");
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [normalizedUsername, formatValid, supabase]);

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
        formData.set("username", normalizedUsername);
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

      <AuthField
        label={t("username")}
        htmlFor="username"
        help={t("usernameHelp")}
        required
      >
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
            @
          </span>
          <input
            id="username"
            name="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setCheckState("idle");
            }}
            autoComplete="off"
            spellCheck={false}
            required
            placeholder={t("usernamePlaceholder")}
            className={`${inputClass} pl-7 pr-9`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {usernameState === "checking" && (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            )}
            {usernameState === "available" && (
              <Check className="h-4 w-4 text-emerald-600" />
            )}
            {(usernameState === "taken" || usernameState === "invalid") && (
              <X className="h-4 w-4 text-red-500" />
            )}
          </span>
        </div>
      </AuthField>
      {usernameState === "taken" && (
        <p className="-mt-3 text-xs text-red-600">{t("usernameTaken")}</p>
      )}
      {usernameState === "invalid" && (
        <p className="-mt-3 text-xs text-red-600">{t("invalidUsername")}</p>
      )}

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

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-zinc-900">
          {t("accountTypeLabel")}
        </legend>
        <p className="text-xs text-zinc-500">{t("accountTypeHelp")}</p>
        <input type="hidden" name="personaPreference" value={persona} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              { value: "staff", icon: Shield, labelKey: "accountTypeStaff" },
              { value: "player", icon: UserCircle, labelKey: "accountTypePlayer" },
              { value: "parent", icon: Users, labelKey: "accountTypeParent" },
            ] as const
          ).map(({ value, icon: Icon, labelKey }) => {
            const active = persona === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPersona(value)}
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

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
        disabled={isPending || usernameState === "taken" || usernameState === "invalid" || !passwordOk}
        className="w-full"
      >
        {t("submitSignup")}
      </Button>
    </form>
  );
}
