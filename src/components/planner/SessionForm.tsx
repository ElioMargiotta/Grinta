"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  createSessionAction,
  updateSessionAction,
} from "@/app/[locale]/(app)/planner/actions";

type Initial = {
  id: string;
  date: string;
  start_time: string | null;
  duration_minutes: number | null;
  theme: string | null;
  notes: string | null;
};

export function SessionForm({
  teamId,
  initial,
  defaultDate,
  defaultStartTime,
}: {
  teamId: string;
  initial?: Initial;
  defaultDate?: string;
  defaultStartTime?: string;
}) {
  const t = useTranslations("planner.session");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const action = initial ? updateSessionAction : createSessionAction;

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        formData.set("locale", locale);
        formData.set("teamId", teamId);
        if (initial) formData.set("id", initial.id);
        startTransition(async () => {
          const result = await action(formData);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="date"
          name="date"
          type="date"
          label={t("date")}
          defaultValue={initial?.date ?? defaultDate ?? ""}
          required
        />
        <Input
          id="startTime"
          name="startTime"
          type="time"
          label={t("startTime")}
          defaultValue={
            initial?.start_time?.slice(0, 5) ?? defaultStartTime ?? ""
          }
        />
        <Input
          id="duration"
          name="duration"
          type="number"
          min={1}
          label={t("duration")}
          defaultValue={initial?.duration_minutes ?? ""}
        />
        <Input
          id="theme"
          name="theme"
          label={t("theme")}
          defaultValue={initial?.theme ?? ""}
        />
      </div>
      <Textarea
        id="notes"
        name="notes"
        label={t("notes")}
        defaultValue={initial?.notes ?? ""}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" loading={isPending}>
        {t("submit")}
      </Button>
    </form>
  );
}
