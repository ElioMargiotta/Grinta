"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { deleteExerciseAction } from "@/app/[locale]/(app)/exercises/actions";

export function DeleteExerciseButton({ id }: { id: string }) {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="danger"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Delete this exercise?")) return;
        const fd = new FormData();
        fd.set("id", id);
        fd.set("locale", locale);
        startTransition(async () => {
          await deleteExerciseAction(fd);
        });
      }}
    >
      Delete
    </Button>
  );
}
