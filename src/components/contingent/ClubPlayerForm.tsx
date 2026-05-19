"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  createClubPlayerAction,
  updateClubPlayerAction,
} from "@/app/[locale]/(app)/contingent/actions";

export type EditablePlayer = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  position: string | null;
  jersey_number: number | null;
  notes: string | null;
};

export function ClubPlayerForm({ player }: { player?: EditablePlayer }) {
  const t = useTranslations("contingent.form");
  const locale = useLocale();
  const router = useRouter();
  const isEdit = Boolean(player);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="grid gap-3 sm:grid-cols-2"
      action={(formData) => {
        setError(null);
        setSaved(false);
        formData.set("locale", locale);
        if (player) formData.set("playerId", player.id);
        startTransition(async () => {
          const result = isEdit
            ? await updateClubPlayerAction(formData)
            : await createClubPlayerAction(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          if (isEdit) {
            setSaved(true);
            router.refresh();
          } else {
            formRef.current?.reset();
          }
        });
      }}
    >
      <Input
        id="firstName"
        name="firstName"
        label={t("firstName")}
        required
        defaultValue={player?.first_name ?? ""}
      />
      <Input
        id="lastName"
        name="lastName"
        label={t("lastName")}
        required
        defaultValue={player?.last_name ?? ""}
      />
      <Input
        id="birthDate"
        name="birthDate"
        type="date"
        label={t("birthDate")}
        defaultValue={player?.birth_date ?? ""}
      />
      <Input
        id="position"
        name="position"
        label={t("position")}
        placeholder={t("positionPlaceholder")}
        defaultValue={player?.position ?? ""}
      />
      <Input
        id="jerseyNumber"
        name="jerseyNumber"
        type="number"
        min={0}
        max={99}
        label={t("jersey")}
        defaultValue={player?.jersey_number ?? ""}
      />
      <div className="sm:col-span-2">
        <Textarea
          id="notes"
          name="notes"
          label={t("notes")}
          defaultValue={player?.notes ?? ""}
        />
      </div>
      {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="sm:col-span-2 text-sm text-emerald-700 dark:text-emerald-300">
          {t("saved")}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" loading={isPending} loadingLabel={t("saving")}>
          {isEdit ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}
