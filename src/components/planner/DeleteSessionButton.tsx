"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { deleteSessionAction } from "@/app/[locale]/(app)/planner/actions";

export function DeleteSessionButton({
  id,
  teamId,
}: {
  id: string;
  teamId: string;
}) {
  const t = useTranslations("planner.session");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="danger"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Delete this session?")) return;
        const fd = new FormData();
        fd.set("id", id);
        fd.set("teamId", teamId);
        fd.set("locale", locale);
        startTransition(async () => {
          await deleteSessionAction(fd);
        });
      }}
    >
      {t("delete")}
    </Button>
  );
}
