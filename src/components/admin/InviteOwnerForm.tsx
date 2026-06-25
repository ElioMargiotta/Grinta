"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { inviteClubOwnerAction } from "@/app/[locale]/(admin)/admin/actions";

type State = { ok?: true; error?: string } | null;

export function InviteOwnerForm({ clubId, locale }: { clubId: string; locale: string }) {
  const t = useTranslations("admin");
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => inviteClubOwnerAction(formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2.5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="clubId" value={clubId} />
      <div className="flex gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder={t("owner.placeholder")}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Mail className="h-4 w-4" />
          {pending ? t("owner.sending") : t("owner.send")}
        </button>
      </div>
      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
          {t("owner.sent")}
        </p>
      )}
    </form>
  );
}
