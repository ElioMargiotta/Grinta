"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { acceptInvitationAction } from "@/app/[locale]/(auth)/invite/[token]/actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const locale = useLocale();
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
          if (result?.error) setError(result.error);
        });
      }}
    >
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Acceptation…" : "Accepter et rejoindre le club"}
      </Button>
    </form>
  );
}
