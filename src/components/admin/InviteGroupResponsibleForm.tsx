"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fieldVariants } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { AccountDirectoryInput } from "@/components/account/AccountDirectoryInput";
import { inviteClubGroupResponsibleAction } from "@/app/[locale]/(admin)/admin/actions";

type State = { ok?: true; error?: string } | null;

export function InviteGroupResponsibleForm({
  groupId,
  locale,
}: {
  groupId: string;
  locale: string;
}) {
  const t = useTranslations("admin");
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => inviteClubGroupResponsibleAction(formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="groupId" value={groupId} />

      <AccountDirectoryInput
        name="identifier"
        label={t("owner.identifier")}
        required
        placeholder={t("owner.placeholder")}
        inputClassName={cn(fieldVariants(), "px-3 py-2")}
      />

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm">
          <input
            type="radio"
            name="scope"
            value="group"
            defaultChecked
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="block font-medium text-foreground">
              {t("regroupements.scopeGroup")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("regroupements.scopeGroupHint")}
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm">
          <input
            type="radio"
            name="scope"
            value="group_and_members"
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="block font-medium text-foreground">
              {t("regroupements.scopeGroupAndMembers")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("regroupements.scopeGroupAndMembersHint")}
            </span>
          </span>
        </label>
      </fieldset>

      <Button type="submit" loading={pending} className="self-start">
        <Mail className="h-4 w-4" />
        {pending ? t("owner.sending") : t("owner.send")}
      </Button>

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
