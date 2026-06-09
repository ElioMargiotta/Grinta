"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { deleteClubPlayerAction } from "@/app/[locale]/(app)/contingent/actions";

export function DeletePlayerSection({
  playerId,
  playerName,
}: {
  playerId: string;
  playerName: string;
}) {
  const t = useTranslations("contingent.deleteSection");
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);
    const fd = new FormData();
    fd.set("playerId", playerId);
    fd.set("locale", locale);
    startTransition(async () => {
      const result = await deleteClubPlayerAction(fd);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/50 p-6 dark:border-red-500/30 dark:bg-red-950/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex-1">
          <div className="text-base font-semibold text-red-900 dark:text-red-100">
            {t("title")}
          </div>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">
            {t.rich("description", {
              name: playerName,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>

          {!confirming ? (
            <Button
              variant="danger"
              size="sm"
              className="mt-4"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t("deleteButton")}
            </Button>
          ) : (
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                loading={isPending}
                loadingLabel={t("deleting")}
              >
                {t("confirmButton")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                disabled={isPending}
              >
                {t("cancel")}
              </Button>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
