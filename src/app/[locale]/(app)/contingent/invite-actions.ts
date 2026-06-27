"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentMembership } from "@/lib/club/context";
import { getSiteUrl } from "@/lib/site-url";
import { sendClubInvitationEmail } from "@/lib/email/invitations";

export type InviteActionError =
  | "missing_fields"
  | "invalid_email"
  | "player_not_in_club"
  | "email_already_linked_to_other_player"
  | "rate_limited"
  | "db_error";

export type CreatePlayerInviteResult =
  | {
      ok: true;
      url: string;
      token: string;
      expiresAt: string;
      emailSent: boolean;
      emailError?: string;
    }
  | { ok: false; error: InviteActionError; message?: string };

function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function createPlayerInviteAction(
  formData: FormData,
): Promise<CreatePlayerInviteResult> {
  const locale = String(formData.get("locale") ?? "fr");
  const playerId = String(formData.get("playerId") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();
  // L'email est désormais OPTIONNEL : un lien réclamable se partage par
  // WhatsApp/copier. S'il est fourni, on l'utilise pour l'envoi + la
  // traçabilité et on garde les garde-fous d'unicité.
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!playerId) {
    return { ok: false, error: "missing_fields" };
  }
  if (email && !isPlausibleEmail(email)) {
    return { ok: false, error: "invalid_email" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);

  const { data: player } = await supabase
    .from("players")
    .select("id, club_id, first_name, last_name")
    .eq("id", playerId)
    .maybeSingle();
  if (!player || player.club_id !== membership.club_id) {
    return { ok: false, error: "player_not_in_club" };
  }

  // Pre-check (email fourni uniquement) : si un compte avec cet email est déjà
  // lié à une AUTRE fiche de ce club, l'unique index (club_id, user_id)
  // bloquerait la réclamation. On échoue tôt avec un message clair.
  if (email) {
    const { data: conflictPlayerId } = await supabase.rpc(
      "player_email_already_linked_in_club",
      {
        p_club_id: membership.club_id,
        p_email: email,
        p_player_id: playerId,
      },
    );
    if (conflictPlayerId) {
      return { ok: false, error: "email_already_linked_to_other_player" };
    }
  }

  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");

  const { data: created, error } = await supabase
    .from("club_invitations")
    .insert({
      club_id: membership.club_id,
      kind: "player",
      email: email || null,
      token_hash: tokenHash,
      player_id: playerId,
      team_id: teamId || null,
      invited_by: user.id,
    })
    .select("id, expires_at")
    .single();

  if (error) {
    if (error.message?.includes("rate_limited")) {
      return { ok: false, error: "rate_limited", message: error.message };
    }
    console.error("[createPlayerInviteAction] insert failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      clubId: membership.club_id,
      access: membership.access_level,
    });
    return { ok: false, error: "db_error", message: error.message };
  }

  const url = `${getSiteUrl()}/${locale}/invite/${token}`;

  let teamName: string | null = null;
  if (teamId) {
    const { data: team } = await supabase
      .from("teams")
      .select("name")
      .eq("id", teamId)
      .maybeSingle();
    teamName = team?.name ?? null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const playerName = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() || null;

  // Envoi email seulement si une adresse a été fournie. Sans email, le lien est
  // purement réclamable (partage WhatsApp/copier).
  const emailResult = email
    ? await sendClubInvitationEmail(supabase, {
        invitationId: created.id,
        kind: "player",
        locale,
        to: email,
        clubName: membership.club_name,
        inviterName: profile?.full_name ?? null,
        roleName: null,
        playerName,
        teamName,
        acceptUrl: url,
        expiresAt: created.expires_at,
        brandColor: membership.theme_primary_color,
      })
    : ({ ok: false, reason: "no_email" } as const);

  revalidatePath(`/${locale}/contingent/${playerId}`);

  return {
    ok: true,
    url,
    token,
    expiresAt: created.expires_at,
    emailSent: emailResult.ok,
    ...(emailResult.ok ? {} : { emailError: emailResult.reason }),
  };
}

export type ResendPlayerInviteResult =
  | { ok: true; emailSent: boolean; url: string; emailError?: string }
  | { ok: false; error: "missing_id" | "not_found" | "not_pending" | "db_error"; message?: string };

/**
 * Rotates the token of a pending invitation and sends a fresh email.
 * The old URL becomes invalid (hash changed). Used by the coach when an
 * invitee says they never got the email or the link expired soon.
 */
export async function resendPlayerInviteAction(
  formData: FormData,
): Promise<ResendPlayerInviteResult> {
  const locale = String(formData.get("locale") ?? "fr");
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  const playerId = String(formData.get("playerId") ?? "").trim();
  if (!inviteId) return { ok: false, error: "missing_id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);

  const { data: invitation, error: loadErr } = await supabase
    .from("club_invitations")
    .select("id, club_id, kind, email, player_id, team_id, status, expires_at")
    .eq("id", inviteId)
    .maybeSingle();
  if (loadErr || !invitation) return { ok: false, error: "not_found" };
  if (invitation.club_id !== membership.club_id) return { ok: false, error: "not_found" };
  if (invitation.status !== "pending") return { ok: false, error: "not_pending" };

  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");

  const { error: updateErr } = await supabase
    .from("club_invitations")
    .update({
      token_hash: tokenHash,
      email_status: "pending",
      email_sent_at: null,
      email_provider_id: null,
    })
    .eq("id", inviteId);
  if (updateErr) {
    console.error("[resendPlayerInviteAction] token rotation failed", updateErr);
    return { ok: false, error: "db_error", message: updateErr.message };
  }

  const url = `${getSiteUrl()}/${locale}/invite/${token}`;

  const [{ data: player }, { data: profile }] = await Promise.all([
    invitation.player_id
      ? supabase
          .from("players")
          .select("first_name, last_name")
          .eq("id", invitation.player_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  let teamName: string | null = null;
  if (invitation.team_id) {
    const { data: team } = await supabase
      .from("teams")
      .select("name")
      .eq("id", invitation.team_id)
      .maybeSingle();
    teamName = team?.name ?? null;
  }

  const playerName = player
    ? `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() || null
    : null;

  const emailResult = await sendClubInvitationEmail(supabase, {
    invitationId: invitation.id,
    kind: invitation.kind as "player" | "staff",
    locale,
    to: invitation.email,
    clubName: membership.club_name,
    inviterName: profile?.full_name ?? null,
    roleName: null,
    playerName,
    teamName,
    acceptUrl: url,
    expiresAt: invitation.expires_at,
    brandColor: membership.theme_primary_color,
  });

  if (playerId) revalidatePath(`/${locale}/contingent/${playerId}`);

  return {
    ok: true,
    emailSent: emailResult.ok,
    url,
    ...(emailResult.ok ? {} : { emailError: emailResult.reason }),
  };
}

export async function revokePlayerInviteAction(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "fr");
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  const playerId = String(formData.get("playerId") ?? "").trim();
  if (!inviteId) return;

  const supabase = await createClient();
  await supabase
    .from("club_invitations")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("status", "pending");

  if (playerId) revalidatePath(`/${locale}/contingent/${playerId}`);
}
