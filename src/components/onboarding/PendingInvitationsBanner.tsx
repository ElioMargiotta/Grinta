"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Mail, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { acceptMyInvitationAction } from "@/app/[locale]/(app)/invitations-actions";

type PendingInvitation = {
  invitation_id: string;
  club_name: string;
  role_name: string;
  invited_by_name: string | null;
};

export function PendingInvitationsBanner({
  invitations,
}: {
  invitations: PendingInvitation[];
}) {
  const t = useTranslations("onboarding.invitations");
  const [isPending, startTransition] = useTransition();
  if (invitations.length === 0) return null;

  const accept = (id: string) => {
    const fd = new FormData();
    fd.set("invitationId", id);
    startTransition(async () => {
      await acceptMyInvitationAction(fd);
    });
  };

  return (
    <div className="space-y-3">
      {invitations.map((inv) => (
        <div
          key={inv.invitation_id}
          className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Mail className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                {t.rich("invitedTo", { club: inv.club_name, strong: (chunks) => <strong>{chunks}</strong> })}{inv.invited_by_name ? ` ${t("invitedBy", { name: inv.invited_by_name })}` : ""}
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-300">
                {t("proposedRole", { role: inv.role_name })}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => accept(inv.invitation_id)}
            disabled={isPending}
          >
            <Check className="h-4 w-4" />
            {t("accept")}
          </Button>
        </div>
      ))}
    </div>
  );
}
