"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createTeamAction } from "@/app/[locale]/(app)/teams/actions";

export function NewTeamForm() {
  const t = useTranslations("teams.form");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        formData.set("locale", locale);
        startTransition(async () => {
          try {
            const result = await createTeamAction(formData);
            if (result?.error) setError(result.error);
          } catch (e) {
            // Surface anything that isn't a Next redirect (which is throw-based)
            const msg = e instanceof Error ? e.message : "Unknown error";
            if (!msg.includes("NEXT_REDIRECT")) setError(msg);
          }
        });
      }}
    >
      <Input id="name" name="name" label={t("name")} required />
      <Input id="season" name="season" label={t("season")} placeholder="2025-2026" />
      <Input id="ageGroup" name="ageGroup" label={t("ageGroup")} placeholder="U13" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {t("submit")}
      </Button>
    </form>
  );
}
