"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLoading } from "@/components/ui/LoadingProvider";
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
  const { run } = useLoading();

  const canConfirm = typed.trim() === teamName.trim();

  const handleDelete = () => {
    setError(null);
    if (!canConfirm) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("locale", locale);
    startTransition(async () => {
      try {
        await run(() => archiveTeamAction(fd), {
          label: t("deleting"),
          message: tc("pleaseWait"),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : tc("unknownError");
        if (!msg.includes("NEXT_REDIRECT")) setError(msg);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <div className="text-base font-semibold text-destructive">
            {t("title")}
          </div>
          <p className="mt-1 text-sm text-destructive">
            {t("description")}
          </p>
          <p className="mt-2 text-sm font-medium text-destructive">
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
            <div className="mt-4 flex flex-col gap-3 rounded-md border border-destructive/30 bg-card p-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground">
                  {t.rich("confirmLabel", { name: teamName, strong: (chunks) => <strong>{chunks}</strong> })}
                </span>
                <input
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-destructive focus:outline-none focus:ring-2 focus:ring-destructive/15"
                  autoFocus
                />
              </label>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={!canConfirm}
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
