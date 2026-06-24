"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import {
  addPlatformAdminAction,
  removePlatformAdminAction,
} from "@/app/[locale]/(admin)/admin/actions";
import type { PlatformAdminRow } from "@/lib/admin/queries";

type State = { ok?: true; error?: string } | null;

export function AdminsManager({
  admins,
  currentUserId,
  locale,
}: {
  admins: PlatformAdminRow[];
  currentUserId: string;
  locale: string;
}) {
  const t = useTranslations("admin");
  const [addState, addAction, addPending] = useActionState<State, FormData>(
    async (_prev, formData) => addPlatformAdminAction(formData),
    null,
  );
  const [removeState, removeAction] = useActionState<State, FormData>(
    async (_prev, formData) => removePlatformAdminAction(formData),
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={addAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="locale" value={locale} />
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {t("admins.addLabel")}
          </span>
          <input
            name="email"
            type="email"
            required
            placeholder="email@exemple.com"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <button
          type="submit"
          disabled={addPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {addPending ? t("common.saving") : t("admins.add")}
        </button>
      </form>

      {(addState?.error || removeState?.error) && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
          {addState?.error || removeState?.error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {admins.map((a) => (
            <li key={a.user_id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {a.full_name ?? a.user_id}
                </div>
                {a.note && <div className="text-xs text-zinc-500 dark:text-zinc-400">{a.note}</div>}
              </div>
              {a.user_id === currentUserId ? (
                <span className="text-xs text-zinc-400">{t("admins.you")}</span>
              ) : (
                <form action={removeAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="userId" value={a.user_id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("admins.remove")}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
