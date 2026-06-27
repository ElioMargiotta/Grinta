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
  | "username_not_found"
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
      direct: boolean;
      targetLabel?: string;
      emailError?: string;
    }
  | { ok: false; error: InviteActionError; message?: string };

function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeInviteIdentifier(value: string): string {
  return value.trim().replace(/^@+/, (match) => (match ? "@" : ""));
}

function isUsernameIdentifier(value: string): boolean {
  const raw = value.trim();
  const username = raw.startsWith("@") ? raw.slice(1) : raw;
  return username.length > 0 && !username.includes("@");
}

export async function createPlayerInviteAction(
  formData: FormData,
): Promise<CreatePlayerInviteResult> {
  const locale = String(formData.get("locale") ?? "fr");
  const playerId = String(formData.get("playerId") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();
  // Cible du lien : le joueur lui-même ('player' → players.user_id) ou un
  // parent/tuteur ('guardian' → player_guardians). Défaut : player.
  const target =
    String(formData.get("target") ?? "player") === "guardian"
      ? "guardian"
      : "player";
  // Identifiant optionnel : @username ou email. Vide = lien réclamable à
  // partager (WhatsApp/copier).
  const inviteIdentifier = normalizeInviteIdentifier(
    String(formData.get("email") ?? ""),
  );
  const isEmailInvite = inviteIdentifier.includes("@") && !inviteIdentifier.startsWith("@");
  const email = isEmailInvite ? inviteIdentifier.toLowerCase() : "";

  if (!playerId) {
    return { ok: false, error: "missing_fields" };
  }
  if (isEmailInvite && !isPlausibleEmail(email)) {
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

  // Pre-check (cible joueur + email fourni uniquement) : un tuteur ne pose
  // jamais players.user_id, donc l'unique index ne le concerne pas.
  if (target === "player" && email) {
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

  let targetUserId: string | null = null;
  let targetLabel: string | null = null;
  let resolvedEmail: string | null = null;
  if (inviteIdentifier) {
    const { data: resolvedTarget, error: resolveError } = await supabase
      .rpc("resolve_invitation_target", { p_identifier: inviteIdentifier })
      .maybeSingle<{
        user_id: string;
        email: string | null;
        username: string | null;
        full_name: string | null;
      }>();

    if (resolveError) {
      console.error("[createPlayerInviteAction] target resolve failed", {
        message: resolveError.message,
        details: resolveError.details,
      });
      return { ok: false, error: "db_error", message: resolveError.message };
    }

    if (resolvedTarget?.user_id) {
      targetUserId = resolvedTarget.user_id;
      resolvedEmail = resolvedTarget.email;
      targetLabel =
        resolvedTarget.username ? `@${resolvedTarget.username}` : resolvedTarget.email;
    } else if (isUsernameIdentifier(inviteIdentifier)) {
      return { ok: false, error: "username_not_found" };
    }
  }

  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");

  const { data: created, error } = await supabase
    .from("club_invitations")
    .insert({
      club_id: membership.club_id,
      kind: target,
      email: email || null,
      target_user_id: targetUserId,
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

  if (targetUserId) {
    const capability =
      target === "guardian" ? { can_parent: true } : { can_play: true };
    const { error: capabilityError } = await supabase
      .from("profiles")
      .update(capability)
      .eq("id", targetUserId);
    if (capabilityError) {
      console.error("[createPlayerInviteAction] capability update failed", {
        targetUserId,
        target,
        message: capabilityError.message,
      });
    }
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

  // Si le compte existe déjà, l'invitation apparaît directement dans son
  // portail. On n'envoie un email/lien que pour les invitations non ciblées.
  const emailResult = email && !targetUserId
    ? await sendClubInvitationEmail(supabase, {
        invitationId: created.id,
        kind: "player",
        locale,
        to: resolvedEmail ?? email,
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
    direct: Boolean(targetUserId),
    ...(targetLabel ? { targetLabel } : {}),
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
