import "server-only";
import { render } from "@react-email/render";
import { getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ClubInvitationEmail } from "@/emails/ClubInvitationEmail";
import { getResend, getResendFromAddress } from "./resend";

export type SendClubInvitationEmailInput = {
  invitationId: string;
  kind: "player" | "staff";
  locale: string;
  to: string;
  clubName: string;
  inviterName: string | null;
  roleName: string | null;
  playerName: string | null;
  teamName: string | null;
  acceptUrl: string;
  expiresAt: string;
  brandColor?: string;
};

export type SendClubInvitationEmailResult =
  | { ok: true; providerId: string }
  | { ok: false; reason: string };

const DEFAULT_BRAND_COLOR = "#171717";
const SUPPORTED_LOCALES = ["fr", "en", "de", "it"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function normalizeLocale(locale: string): SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as SupportedLocale)
    : "fr";
}

export async function sendClubInvitationEmail(
  supabase: SupabaseClient,
  input: SendClubInvitationEmailInput,
): Promise<SendClubInvitationEmailResult> {
  const locale = normalizeLocale(input.locale);
  const t = await getTranslations({ locale, namespace: "email.invitation" });

  const brand = input.brandColor || DEFAULT_BRAND_COLOR;
  const inviter = input.inviterName?.trim() || t("defaultInviter");

  const expiry = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(input.expiresAt),
  );

  const subject =
    input.kind === "player"
      ? t("subject.player", { club: input.clubName })
      : t("subject.staff", { club: input.clubName });

  const heading =
    input.kind === "player"
      ? t("heading.player", { club: input.clubName })
      : t("heading.staff", { club: input.clubName });

  const intro = t("intro", { inviter, club: input.clubName });

  const detail =
    input.kind === "player"
      ? t("detail.player", {
          name: input.playerName?.trim() || t("defaultPlayer"),
          team: input.teamName?.trim() || t("noTeam"),
        })
      : t("detail.staff", {
          role: input.roleName?.trim() || t("defaultRole"),
        });

  const html = await render(
    ClubInvitationEmail({
      kind: input.kind,
      clubName: input.clubName,
      inviterName: input.inviterName,
      roleName: input.roleName,
      playerName: input.playerName,
      teamName: input.teamName,
      acceptUrl: input.acceptUrl,
      expiresAtIso: input.expiresAt,
      brandColor: brand,
      copy: {
        preview: t("preview"),
        heading,
        intro,
        detail,
        cta: t("cta"),
        expiry: t("expiry", { date: expiry }),
        fallbackLabel: t("fallbackLabel"),
        securityNote: t("securityNote"),
        footer: t("footer"),
      },
    }),
  );

  const text = [heading, "", intro, "", detail, "", input.acceptUrl, "", t("securityNote")].join(
    "\n",
  );

  let providerId: string | null = null;
  let failureReason: string | null = null;
  try {
    const result = await getResend().emails.send({
      from: getResendFromAddress(),
      to: input.to,
      subject,
      html,
      text,
      headers: { "X-Grinta-Invitation-Id": input.invitationId },
      tags: [
        { name: "kind", value: input.kind },
        { name: "locale", value: locale },
      ],
    });
    if (result.error) {
      failureReason = result.error.message;
    } else if (result.data?.id) {
      providerId = result.data.id;
    } else {
      failureReason = "no_provider_id";
    }
  } catch (err) {
    failureReason = err instanceof Error ? err.message : "unknown_error";
  }

  if (!providerId) {
    console.error("[sendClubInvitationEmail] failed", {
      to: input.to,
      kind: input.kind,
      invitationId: input.invitationId,
      from: getResendFromAddress(),
      reason: failureReason,
    });
  }

  await supabase
    .from("club_invitations")
    .update({
      email_status: providerId ? "sent" : "failed",
      email_sent_at: providerId ? new Date().toISOString() : null,
      email_provider_id: providerId,
    })
    .eq("id", input.invitationId);

  if (providerId) return { ok: true, providerId };
  return { ok: false, reason: failureReason ?? "send_failed" };
}
