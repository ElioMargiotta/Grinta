"use client";

import { useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { deleteExerciseAction } from "@/app/[locale]/(app)/exercises/actions";

export function DeleteExerciseButton({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="danger"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(t("exercises.delete.confirmTitle"))) return;
        const fd = new FormData();
        fd.set("id", id);
        fd.set("locale", locale);
        startTransition(async () => {
          await deleteExerciseAction(fd);
        });
      }}
    >
      {t("exercises.delete.delete")}
    </Button>
  );
}
