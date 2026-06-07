"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AuthField } from "@/components/auth/AuthField";
import { Link } from "@/i18n/navigation";
import { requestPasswordResetAction } from "@/app/[locale]/forgot-password/actions";

const inputClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-5">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          <h2 className="text-base font-semibold text-emerald-900">
            {t("forgotSentTitle")}
          </h2>
          <p className="text-sm text-emerald-800">{t("forgotSent")}</p>
        </div>
        <Link href="/login" className="text-sm font-medium text-zinc-900 underline">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">{t("forgotTitle")}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t("forgotSubtitle")}</p>
      </div>

      <form
        className="flex flex-col gap-5"
        action={(formData) => {
          setError(null);
          formData.set("locale", locale);
          startTransition(async () => {
            const result = await requestPasswordResetAction(formData);
            if (result?.sent) setSent(true);
            else setError(t("genericError"));
          });
        }}
      >
        <AuthField label={t("email")} htmlFor="email" required>
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

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button
          type="submit"
          loading={isPending}
          loadingLabel={t("forgotSubmitting")}
          className="w-full"
        >
          {t("forgotSubmit")}
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-600">
        <Link href="/login" className="font-medium text-zinc-900 underline">
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
