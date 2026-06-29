"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Mail, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import {
  acceptMyInvitationAction,
  rejectMyInvitationAction,
} from "@/app/[locale]/(app)/invitations-actions";

type PendingInvitation = {
  invitation_id: string;
  club_id: string;
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
  const [isAccepting, startAccept] = useTransition();
  const [isDeclining, startDecline] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PendingInvitation | null>(null);
  if (invitations.length === 0) return null;

  const busy = isAccepting || isDeclining;

  const accept = (inv: PendingInvitation) => {
    const fd = new FormData();
    fd.set("invitationId", inv.invitation_id);
    fd.set("clubId", inv.club_id);
    setError(null);
    setPendingId(inv.invitation_id);
    startAccept(async () => {
      const res = await acceptMyInvitationAction(fd);
      if (res && "error" in res && res.error) setError(res.error);
      setPendingId(null);
    });
  };

  const confirmDecline = () => {
    if (!confirming) return;
    const fd = new FormData();
    fd.set("invitationId", confirming.invitation_id);
    setError(null);
    startDecline(async () => {
      const res = await rejectMyInvitationAction(fd);
      if (res && "error" in res && res.error) setError(res.error);
      else setConfirming(null);
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
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirming(inv)}
              disabled={busy}
            >
              <X className="h-4 w-4" />
              {t("decline")}
            </Button>
            <Button
              size="sm"
              onClick={() => accept(inv)}
              loading={isAccepting && pendingId === inv.invitation_id}
              disabled={busy}
            >
              <Check className="h-4 w-4" />
              {t("accept")}
            </Button>
          </div>
        </div>
      ))}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !isDeclining) setConfirming(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("declineConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("declineConfirmBody", { club: confirming?.club_name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(null)}
              disabled={isDeclining}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDecline}
              loading={isDeclining}
            >
              {t("declineConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
