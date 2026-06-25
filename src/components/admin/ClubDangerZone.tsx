"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
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
}: {
  clubId: string;
  clubName: string;
  locale: string;
  archived: boolean;
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
  const nameMatches = confirmName.trim() === clubName;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {t("danger.title")}
      </h2>
      <div className="flex flex-col gap-4 rounded-2xl border border-rose-200 bg-rose-50/40 p-5 dark:border-rose-900/40 dark:bg-rose-950/20">
        {/* Archive / Restore */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {archived ? t("danger.restoreTitle") : t("danger.archiveTitle")}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {archived ? t("danger.restoreHint") : t("danger.archiveHint")}
            </p>
          </div>
          <form action={archiveSubmit}>
            <input type="hidden" name="clubId" value={clubId} />
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              disabled={archivePending}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
            </button>
          </form>
        </div>

        {archiveState?.error && (
          <p className="rounded-lg bg-rose-100 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            {archiveState.error}
          </p>
        )}

        <div className="h-px bg-rose-200/70 dark:bg-rose-900/30" />

        {/* Hard delete */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
                {t("danger.deleteTitle")}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {t("danger.deleteHint")}
              </p>
            </div>
            {!confirmOpen && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-900/50 dark:bg-zinc-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="h-4 w-4" />
                {t("danger.delete")}
              </button>
            )}
          </div>

          {confirmOpen && (
            <form action={deleteSubmit} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="clubId" value={clubId} />
              <input type="hidden" name="locale" value={locale} />
              <label className="text-xs text-zinc-600 dark:text-zinc-300">
                {t("danger.confirmLabel", { name: clubName })}
              </label>
              <input
                name="confirmName"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
                className="w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-rose-500 dark:border-rose-900/50 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!nameMatches || deletePending}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-40 dark:bg-rose-700 dark:hover:bg-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletePending ? t("danger.deleting") : t("danger.deleteConfirm")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmName("");
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t("danger.cancel")}
                </button>
              </div>
              {deleteState?.error && (
                <p className="rounded-lg bg-rose-100 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
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
