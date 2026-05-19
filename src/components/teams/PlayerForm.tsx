"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { createPlayerAction } from "@/app/[locale]/(app)/teams/actions";

export function PlayerForm({ teamId }: { teamId: string }) {
  const t = useTranslations("teams.players");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="grid gap-3 sm:grid-cols-2"
      action={(formData) => {
        setError(null);
        formData.set("locale", locale);
        formData.set("teamId", teamId);
        startTransition(async () => {
          const result = await createPlayerAction(formData);
          if (result?.error) setError(result.error);
          else formRef.current?.reset();
        });
      }}
    >
      <Input id="firstName" name="firstName" label={t("firstName")} required />
      <Input id="lastName" name="lastName" label={t("lastName")} required />
      <Input id="birthDate" name="birthDate" type="date" label={t("birthDate")} />
      <Input id="position" name="position" label={t("position")} placeholder={t("positionPlaceholder")} />
      <Input
        id="jerseyNumber"
        name="jerseyNumber"
        type="number"
        min={0}
        max={99}
        label={t("jersey")}
      />
      <div className="sm:col-span-2">
        <Textarea id="notes" name="notes" label={t("notes")} />
      </div>
      {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" loading={isPending}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
