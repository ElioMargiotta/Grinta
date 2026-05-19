"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { createClubAction } from "@/app/[locale]/(app)/onboarding/club/actions";

const inputClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";

export function OnboardingClubForm() {
  const locale = useLocale();
  const t = useTranslations("onboarding.club");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-5"
      action={(formData) => {
        setError(null);
        formData.set("locale", locale);
        startTransition(async () => {
          const result = await createClubAction(formData);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <AuthField
        label={t("name")}
        htmlFor="name"
        help={t("nameHelp")}
        required
      >
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          placeholder={t("namePlaceholder")}
          className={inputClass}
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
        loadingLabel={t("submitting")}
        className="w-full"
      >
        {t("submit")}
      </Button>
    </form>
  );
}
