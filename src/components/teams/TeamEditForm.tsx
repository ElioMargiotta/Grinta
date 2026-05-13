"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
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
        label="Nom de l'équipe"
        required
        defaultValue={team.name}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id="season"
          name="season"
          label="Saison"
          placeholder="2025-2026"
          defaultValue={team.season ?? ""}
        />
        <Input
          id="ageGroup"
          name="ageGroup"
          label="Catégorie"
          placeholder="U13"
          defaultValue={team.age_group ?? ""}
        />
      </div>

      <Input
        id="photoUrl"
        name="photoUrl"
        label="Photo d'équipe"
        type="url"
        inputMode="url"
        placeholder="https://..."
        defaultValue={team.photo_url ?? ""}
        hint="URL https pour l'instant. L'upload direct peut venir ensuite."
      />

      <Textarea
        id="description"
        name="description"
        label="Description"
        rows={3}
        placeholder="Notes, objectifs, identité de l'équipe…"
        defaultValue={team.description ?? ""}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Enregistré.
        </p>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
