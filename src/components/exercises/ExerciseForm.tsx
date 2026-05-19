"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  createExerciseAction,
  updateExerciseAction,
} from "@/app/[locale]/(app)/exercises/actions";

type Initial = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration_minutes: number | null;
  intensity: string | null;
  equipment: string[] | null;
};

const CATEGORIES = ["warmup", "technical", "tactical", "physical", "cooldown"] as const;
const INTENSITIES = ["low", "medium", "high"] as const;

export function ExerciseForm({ initial }: { initial?: Initial }) {
  const t = useTranslations("exercises");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const action = initial ? updateExerciseAction : createExerciseAction;

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        formData.set("locale", locale);
        if (initial) formData.set("id", initial.id);
        startTransition(async () => {
          const result = await action(formData);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <Input
        id="name"
        name="name"
        label={t("form.name")}
        defaultValue={initial?.name ?? ""}
        required
      />
      <Textarea
        id="description"
        name="description"
        label={t("form.description")}
        defaultValue={initial?.description ?? ""}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id="category"
          name="category"
          label={t("form.category")}
          defaultValue={initial?.category ?? ""}
        >
          <option value="">—</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </Select>
        <Select
          id="intensity"
          name="intensity"
          label={t("form.intensity")}
          defaultValue={initial?.intensity ?? ""}
        >
          <option value="">—</option>
          {INTENSITIES.map((i) => (
            <option key={i} value={i}>
              {t(`intensities.${i}`)}
            </option>
          ))}
        </Select>
        <Input
          id="duration"
          name="duration"
          type="number"
          min={1}
          label={t("form.duration")}
          defaultValue={initial?.duration_minutes ?? ""}
        />
        <Input
          id="equipment"
          name="equipment"
          label={t("form.equipment")}
          placeholder={t("form.equipmentPlaceholder")}
          defaultValue={initial?.equipment?.join(", ") ?? ""}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" loading={isPending}>
        {t("form.submit")}
      </Button>
    </form>
  );
}
