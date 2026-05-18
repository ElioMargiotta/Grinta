"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { archiveTeamAction } from "@/app/[locale]/(app)/teams/actions";

export function DeleteTeamSection({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  const t = useTranslations("teams.deleteSection");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfirm = typed.trim() === teamName.trim();

  const handleDelete = () => {
    setError(null);
    if (!canConfirm) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("locale", locale);
    startTransition(async () => {
      try {
        await archiveTeamAction(fd);
      } catch (e) {
        const msg = e instanceof Error ? e.message : tc("unknownError");
        if (!msg.includes("NEXT_REDIRECT")) setError(msg);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 dark:border-red-500/30 dark:bg-red-950/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex-1">
          <div className="text-base font-semibold text-red-900 dark:text-red-100">
            {t("title")}
          </div>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">
            {t("description")}
          </p>
          <p className="mt-2 text-sm font-medium text-red-900 dark:text-red-100">
            {t("billing")}
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
            <div className="mt-4 flex flex-col gap-3 rounded-md border border-red-200 bg-white p-4 dark:border-red-500/30 dark:bg-zinc-950">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {t.rich("confirmLabel", { name: teamName, strong: (chunks) => <strong>{chunks}</strong> })}
                </span>
                <input
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/15 dark:border-zinc-700 dark:bg-zinc-900"
                  autoFocus
                />
              </label>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={!canConfirm || isPending}
                >
                  {isPending ? t("deleting") : t("confirmButton")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConfirming(false);
                    setTyped("");
                    setError(null);
                  }}
                  disabled={isPending}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
