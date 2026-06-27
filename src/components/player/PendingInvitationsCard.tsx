"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mailbox, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import {
  acceptInvitationByIdAction,
  rejectInvitationByIdAction,
} from "@/app/[locale]/(player)/invitation-actions";

export type PendingInvitation = {
  id: string;
  kind: "staff" | "player" | "guardian";
  clubName: string;
  roleName: string | null;
  teamName: string | null;
  playerName: string | null;
  expiresAt: string;
};

export function PendingInvitationsCard({
  locale,
  invitations,
}: {
  locale: string;
  invitations: PendingInvitation[];
}) {
  const t = useTranslations("invitations");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAccept(id: string) {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", id);
    startTransition(async () => {
      const result = await acceptInvitationByIdAction(fd);
      if (result.ok) {
        router.push(result.redirectTo ?? `/${locale}/me`);
        router.refresh();
      } else {
        alert(t(`errors.${result.error}`));
      }
    });
  }

  function handleReject(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const result = await rejectInvitationByIdAction(fd);
      if (result.ok) {
        router.refresh();
      } else {
        alert(t(`errors.${result.error}`));
      }
    });
  }

  if (invitations.length === 0) return null;

  return (
    <Section>
      <SectionHeader icon={Mailbox} title={t("pendingTitle")} className="mb-3" />
      <ul className="flex flex-col gap-2">
        {invitations.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {inv.clubName}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {inv.kind === "guardian"
                  ? t("childInvitation", {
                      name: inv.playerName ?? t("childFallback"),
                      team: inv.teamName ?? "—",
                    })
                  : inv.kind === "player"
                    ? inv.teamName
                      ? t("playerWithTeam", { team: inv.teamName })
                      : t("playerNoTeam")
                    : t("staffAs", { role: inv.roleName ?? "" })}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReject(inv.id)}
                disabled={isPending}
              >
                <X className="h-3.5 w-3.5" />
                {t("decline")}
              </Button>
              <Button
                size="sm"
                onClick={() => handleAccept(inv.id)}
                loading={isPending}
              >
                <Check className="h-3.5 w-3.5" />
                {t("accept")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
