"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  archiveClubGroupAction,
  deleteClubGroupAction,
} from "@/app/[locale]/(admin)/admin/actions";

type State = { ok?: true; error?: string } | null;

export function ClubGroupDangerZone({
  groupId,
  groupName,
  locale,
  usage,
}: {
  groupId: string;
  groupName: string;
  locale: string;
  usage: { teams: number; players: number; staff: number };
}) {
  const t = useTranslations("admin");
  const [archiveState, archiveSubmit, archivePending] = useActionState<State, FormData>(
    async (_prev, formData) => archiveClubGroupAction(formData),
    null,
  );
  const [deleteState, deleteSubmit, deletePending] = useActionState<State, FormData>(
    async (_prev, formData) => deleteClubGroupAction(formData),
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [confirmDataDeletion, setConfirmDataDeletion] = useState(false);
  const hasData = usage.teams > 0 || usage.players > 0 || usage.staff > 0;
  const nameMatches = confirmName.trim() === groupName;
  const canDelete = nameMatches && (!hasData || confirmDataDeletion);

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
      <h2 className="text-sm font-semibold text-destructive">
        {t("regroupements.managementTitle")}
      </h2>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("regroupements.archiveTitle")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("regroupements.archiveHint")}
          </p>
        </div>
        <form action={archiveSubmit}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="groupId" value={groupId} />
          <Button type="submit" variant="secondary" size="sm" loading={archivePending}>
            <Archive className="h-4 w-4" />
            {archivePending ? t("common.saving") : t("regroupements.archive")}
          </Button>
        </form>
      </div>

      {archiveState?.error && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {archiveState.error}
        </p>
      )}

      <div className="my-4 h-px bg-destructive/20" />

      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-destructive">
              {t("regroupements.deleteTitle")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("regroupements.deleteHint")}
            </p>
          </div>
          {!confirmOpen && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t("regroupements.delete")}
            </Button>
          )}
        </div>

        {confirmOpen && (
          <form action={deleteSubmit} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="groupId" value={groupId} />
            {hasData && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {t("regroupements.deleteDataWarning", {
                  teams: usage.teams,
                  players: usage.players,
                  staff: usage.staff,
                })}
              </div>
            )}
            <label className="text-xs text-muted-foreground">
              {t("danger.confirmLabel", { name: groupName })}
            </label>
            <input
              name="confirmName"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-destructive/40 bg-card px-3 py-2 text-sm text-foreground focus:border-destructive focus:outline-none focus:ring-2 focus:ring-destructive/15"
            />
            {hasData && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="confirmDataDeletion"
                  checked={confirmDataDeletion}
                  onChange={(e) => setConfirmDataDeletion(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                {t("regroupements.confirmDataDeletion")}
              </label>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                variant="danger"
                size="sm"
                disabled={!canDelete || deletePending}
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
                    setConfirmDataDeletion(false);
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
    </section>
  );
}
