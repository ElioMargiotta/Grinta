"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fieldVariants } from "@/components/ui/field";
import { cn } from "@/lib/utils";
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
          className={cn(fieldVariants(), "px-3 py-2")}
        />
        <Button type="submit" loading={pending} className="shrink-0">
          <Mail className="h-4 w-4" />
          {pending ? t("owner.sending") : t("owner.send")}
        </Button>
      </div>
      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
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
