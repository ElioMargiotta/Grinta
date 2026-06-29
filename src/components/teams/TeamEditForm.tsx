"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { updateTeamAction } from "@/app/[locale]/(app)/teams/actions";

type Team = {
  id: string;
  name: string;
  season: string | null;
  age_group: string | null;
  description: string | null;
  photo_url: string | null;
};

export function TeamEditForm({ team }: { team: Team }) {
  const t = useTranslations("teams.editForm");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        setSaved(false);
        formData.set("locale", locale);
        formData.set("teamId", team.id);
        startTransition(async () => {
          const result = await updateTeamAction(formData);
          if (result?.error) setError(result.error);
          else setSaved(true);
        });
      }}
    >
      <Input
        id="name"
        name="name"
        label={t("name")}
        required
        defaultValue={team.name}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id="season"
          name="season"
          label={t("season")}
          placeholder={t("seasonPlaceholder")}
          defaultValue={team.season ?? ""}
        />
        <Input
          id="ageGroup"
          name="ageGroup"
          label={t("ageGroup")}
          placeholder={t("ageGroupPlaceholder")}
          defaultValue={team.age_group ?? ""}
        />
      </div>

      <Input
        id="photoUrl"
        name="photoUrl"
        label={t("photoUrl")}
        type="url"
        inputMode="url"
        placeholder={t("photoUrlPlaceholder")}
        defaultValue={team.photo_url ?? ""}
        hint={t("photoUrlHint")}
      />

      <Textarea
        id="description"
        name="description"
        label={t("description")}
        rows={3}
        placeholder={t("descriptionPlaceholder")}
        defaultValue={team.description ?? ""}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          {t("saved")}
        </p>
      )}

      <Button
        type="submit"
        loading={isPending}
        loadingLabel={t("saving")}
        className="self-start"
      >
        {t("save")}
      </Button>
    </form>
  );
}
