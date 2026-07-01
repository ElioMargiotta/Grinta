"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { updateClubMemberClubsAction } from "@/app/[locale]/(admin)/admin/actions";
import { MemberClubsInput } from "@/components/admin/MemberClubsInput";
import type { DirectoryClub } from "@/lib/admin/queries";

type State = { ok?: true; error?: string } | null;

export function ClubMemberClubsForm({
  clubId,
  locale,
  directory,
  initial,
}: {
  clubId: string;
  locale: string;
  directory: DirectoryClub[];
  initial: string[];
}) {
  const t = useTranslations("admin");
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => updateClubMemberClubsAction(formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="locale" value={locale} />

      <MemberClubsInput directory={directory} initial={initial} />

      {state?.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
          {t("common.saved")}
        </p>
      )}

      <Button type="submit" loading={pending} className="self-start">
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
