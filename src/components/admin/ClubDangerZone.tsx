"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  archiveClubAction,
  restoreClubAction,
  deleteClubAction,
} from "@/app/[locale]/(admin)/admin/actions";

type State = { ok?: true; error?: string } | null;

export function ClubDangerZone({
  clubId,
  clubName,
  locale,
  archived,
  blockingGroupName,
}: {
  clubId: string;
  clubName: string;
  locale: string;
  archived: boolean;
  blockingGroupName?: string;
}) {
  const t = useTranslations("admin");

  const [archiveState, archiveSubmit, archivePending] = useActionState<State, FormData>(
    async (_prev, formData) =>
      archived ? restoreClubAction(formData) : archiveClubAction(formData),
    null,
  );
  const [deleteState, deleteSubmit, deletePending] = useActionState<State, FormData>(
    async (_prev, formData) => deleteClubAction(formData),
    null,
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const blockedByGroup = Boolean(blockingGroupName);
  const nameMatches = confirmName.trim() === clubName;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        {t("danger.title")}
      </h2>
      <div className="flex flex-col gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        {blockedByGroup && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            {t("danger.groupMemberBlock", { group: blockingGroupName ?? "" })}
          </p>
        )}

        {/* Archive / Restore */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              {archived ? t("danger.restoreTitle") : t("danger.archiveTitle")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {archived ? t("danger.restoreHint") : t("danger.archiveHint")}
            </p>
          </div>
          <form action={archiveSubmit}>
            <input type="hidden" name="clubId" value={clubId} />
            <input type="hidden" name="locale" value={locale} />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={archivePending}
              disabled={blockedByGroup}
              className="shrink-0"
            >
              {archived ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              {archivePending
                ? t("common.saving")
                : archived
                  ? t("danger.restore")
                  : t("danger.archive")}
            </Button>
          </form>
        </div>

        {archiveState?.error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {archiveState.error}
          </p>
        )}

        <div className="h-px bg-destructive/20" />

        {/* Hard delete */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-destructive">
                {t("danger.deleteTitle")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("danger.deleteHint")}
              </p>
            </div>
            {!confirmOpen && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={blockedByGroup}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4" />
                {t("danger.delete")}
              </Button>
            )}
          </div>

          {confirmOpen && (
            <form action={deleteSubmit} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="clubId" value={clubId} />
              <input type="hidden" name="locale" value={locale} />
              <label className="text-xs text-muted-foreground">
                {t("danger.confirmLabel", { name: clubName })}
              </label>
              <input
                name="confirmName"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
                className="w-full rounded-lg border border-destructive/40 bg-card px-3 py-2 text-sm text-foreground focus:border-destructive focus:outline-none focus:ring-2 focus:ring-destructive/15"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={!nameMatches || deletePending}
                  loading={deletePending}
                >
                  <Trash2 className="h-4 w-4" />
                  {deletePending ? t("danger.deleting") : t("danger.deleteConfirm")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmName("");
                  }}
                >
                  {t("danger.cancel")}
                </Button>
              </div>
              {deleteState?.error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {deleteState.error}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
