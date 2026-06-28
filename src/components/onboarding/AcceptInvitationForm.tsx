"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { acceptInvitationAction } from "@/app/[locale]/(auth)/invite/[token]/actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const locale = useLocale();
  const t = useTranslations("onboarding.acceptForm");
  const tErrors = useTranslations("invitations.errors");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        formData.set("locale", locale);
        formData.set("token", token);
        startTransition(async () => {
          const result = await acceptInvitationAction(formData);
          if (result?.error) {
            try {
              setError(tErrors(result.error));
            } catch {
              setError(result.error);
            }
          }
        });
      }}
    >
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <Button
        type="submit"
        loading={isPending}
        loadingLabel={t("accepting")}
        className="w-full"
      >
        {t("accept")}
      </Button>
    </form>
  );
}
