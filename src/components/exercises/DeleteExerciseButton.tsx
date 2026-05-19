"use client";

import { useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useLoading } from "@/components/ui/LoadingProvider";
import { deleteExerciseAction } from "@/app/[locale]/(app)/exercises/actions";

export function DeleteExerciseButton({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const { run } = useLoading();

  return (
    <Button
      variant="danger"
      size="sm"
      loading={isPending}
      loadingLabel={t("common.deleting")}
      onClick={() => {
        if (!confirm(t("exercises.delete.confirmTitle"))) return;
        const fd = new FormData();
        fd.set("id", id);
        fd.set("locale", locale);
        startTransition(async () => {
          await run(() => deleteExerciseAction(fd), {
            label: t("common.deleting"),
            message: t("common.pleaseWait"),
          });
        });
      }}
    >
      {t("exercises.delete.delete")}
    </Button>
  );
}
