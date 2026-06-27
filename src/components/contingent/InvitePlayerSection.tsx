"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Copy, Check, X, Send, MessageCircle, UserCircle, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  createPlayerInviteAction,
  resendPlayerInviteAction,
  revokePlayerInviteAction,
} from "@/app/[locale]/(app)/contingent/invite-actions";
import { unlinkPlayerAccountAction } from "@/app/[locale]/(app)/contingent/lifecycle-actions";

type EmailStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "opened";

export type PlayerInvitation = {
  id: string;
  email: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  team_id: string | null;
  expires_at: string;
  email_status: EmailStatus;
  email_sent_at: string | null;
};

export function InvitePlayerSection({
  locale,
  playerId,
  defaultEmail,
  teams,
  pendingInvitations,
  isLinkedToUser,
}: {
  locale: string;
  playerId: string;
  defaultEmail: string;
  teams: { id: string; name: string }[];
  pendingInvitations: PlayerInvitation[];
  isLinkedToUser: boolean;
}) {
  const t = useTranslations("invitePlayer");
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [teamId, setTeamId] = useState<string>("");
  // Cible du lien : le joueur lui-même ou un parent/tuteur (Lot C).
  const [target, setTarget] = useState<"player" | "guardian">("player");
  const [error, setError] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [lastEmailTo, setLastEmailTo] = useState<string | null>(null);
  const [lastEmailSent, setLastEmailSent] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [resendNotice, setResendNotice] = useState<
    | { kind: "success"; email: string }
    | { kind: "error" }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLastUrl(null);
    setLastEmailTo(null);
    setResendNotice(null);
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("playerId", playerId);
    fd.set("email", email.trim());
    fd.set("target", target);
    if (teamId) fd.set("teamId", teamId);

    startTransition(async () => {
      const result = await createPlayerInviteAction(fd);
      if (!result.ok) {
        setError(t(`errors.${result.error}`));
        return;
      }
      setLastUrl(result.url);
      setLastEmailTo(email.trim() || null);
      setLastEmailSent(result.emailSent);
      setCopied(false);
      router.refresh();
    });
  }

  function handleUnlink() {
    if (!window.confirm(t("unlinkConfirm"))) return;
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("playerId", playerId);
    startTransition(async () => {
      await unlinkPlayerAccountAction(fd);
      router.refresh();
    });
  }

  function handleRevoke(inviteId: string) {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("inviteId", inviteId);
    fd.set("playerId", playerId);
    startTransition(async () => {
      await revokePlayerInviteAction(fd);
      router.refresh();
    });
  }

  function handleResend(inviteId: string, emailAddress: string) {
    setResendNotice(null);
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("inviteId", inviteId);
    fd.set("playerId", playerId);
    startTransition(async () => {
      const result = await resendPlayerInviteAction(fd);
      if (!result.ok) {
        setResendNotice({ kind: "error" });
        return;
      }
      if (result.emailSent) {
        setResendNotice({ kind: "success", email: emailAddress });
      } else {
        setResendNotice({ kind: "error" });
      }
      router.refresh();
    });
  }

  function emailStatusLabel(status: EmailStatus): string {
    switch (status) {
      case "delivered":
        return t("pendingEmailDelivered");
      case "opened":
        return t("pendingEmailOpened");
      case "sent":
        return t("pendingEmailSent");
      case "bounced":
      case "complained":
        return t("pendingEmailBounced");
      case "failed":
        return t("pendingEmailFailed");
      default:
        return t("pendingEmailPending");
    }
  }

  return (
    <Section>
      <SectionHeader icon={Mail} title={t("title")} className="mb-3" />

      {isLinkedToUser && target === "player" ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span>{t("alreadyLinked")}</span>
          <button
            type="button"
            onClick={handleUnlink}
            disabled={isPending}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <X className="h-3 w-3" />
            {t("unlink")}
          </button>
        </div>
      ) : (
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {target === "guardian" ? t("descriptionGuardian") : t("description")}
        </p>
      )}

      <>
          {/* Cible : joueur lui-même ou parent/tuteur. */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(
              [
                { value: "player", icon: UserCircle, labelKey: "targetPlayer" },
                { value: "guardian", icon: Users, labelKey: "targetGuardian" },
              ] as const
            ).map(({ value, icon: Icon, labelKey }) => {
              const active = target === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTarget(value)}
                  aria-pressed={active}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-[var(--club-primary)] bg-[var(--club-primary-soft)] text-[var(--club-primary)]"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t(labelKey)}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <Input
              id="invite-email"
              type="email"
              label={t("emailLabel")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              hint={t("emailOptionalHint")}
            />
            {teams.length > 0 && (
              <Select
                id="invite-team"
                label={t("teamLabel")}
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">{t("teamNone")}</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </Select>
            )}
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button type="submit" size="sm" loading={isPending}>
                {t("generate")}
              </Button>
            </div>
          </form>

          {lastUrl && (
            <div className="mt-4 rounded-md border border-[var(--club-line)] bg-[var(--club-primary-soft)] p-3 text-xs">
              {lastEmailSent && lastEmailTo ? (
                <div className="mb-2 flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300">
                  <Check className="h-3 w-3" />
                  {t("emailSent", { email: lastEmailTo })}
                </div>
              ) : lastEmailTo ? (
                <div className="mb-2 font-medium text-amber-700 dark:text-amber-300">
                  {t("emailFailed")}
                </div>
              ) : null}
              <div className="mb-1 font-medium text-zinc-700 dark:text-zinc-200">
                {lastEmailSent ? t("linkFallback") : t("linkReady")}
              </div>
              <div className="break-all font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                {lastUrl}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${t("whatsappMessage")} ${lastUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-[#25D366] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:brightness-95"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {t("shareWhatsApp")}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(lastUrl);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--club-line)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--club-primary)] hover:bg-white/50"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
            </div>
          )}
      </>

      {resendNotice && (
        <div
          className={
            resendNotice.kind === "success"
              ? "mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
              : "mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          }
        >
          {resendNotice.kind === "success"
            ? t("resendSent", { email: resendNotice.email })
            : t("resendFailed")}
        </div>
      )}

      {pendingInvitations.length > 0 && (
        <div className="mt-5 border-t border-[var(--club-line)] pt-4">
          <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t("pendingTitle")}
          </h3>
          <ul className="flex flex-col gap-2">
            {pendingInvitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                    {inv.email ?? t("claimLinkLabel")}
                  </div>
                  <div className="truncate text-[11px] text-zinc-500">
                    {inv.email ? `${emailStatusLabel(inv.email_status)} · ` : ""}
                    {t("expiresAt", {
                      date: new Date(inv.expires_at).toLocaleDateString(locale),
                    })}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {inv.email && (
                    <button
                      type="button"
                      onClick={() => handleResend(inv.id, inv.email!)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Send className="h-3 w-3" />
                      {t("resend")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRevoke(inv.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <X className="h-3 w-3" />
                    {t("revoke")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
