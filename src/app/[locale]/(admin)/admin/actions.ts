"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/auth/getUser";
import { getSiteUrl } from "@/lib/site-url";
import { sendClubInvitationEmail } from "@/lib/email/invitations";

type ActionResult = { ok?: true; error?: string };

function intOrNull(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function tsOrNull(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Liste (JSON) des clubs composant le regroupement — noms libres, purement
// informatifs. Nettoyée : trim, non vides, dédupliquée, cappée à 12.
function memberClubsFromForm(formData: FormData): string[] {
  try {
    const parsed = JSON.parse(String(formData.get("memberClubs") ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
    return [...new Set(cleaned)].slice(0, 12);
  } catch {
    return [];
  }
}

async function guard(): Promise<boolean> {
  return isPlatformAdmin();
}

/**
 * Provision a club + licence (admin_create_club RPC), then issue an owner
 * invitation to the provided email reusing the standard staff-invite + email
 * pipeline (create_invitation now allows platform admins to invite into any
 * club). Redirects to the new club's detail page.
 */
export async function createClubAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const locale = String(formData.get("locale") ?? "fr");
  const name = String(formData.get("name") ?? "").trim();
  const ownerIdentifier = String(formData.get("ownerIdentifier") ?? formData.get("ownerEmail") ?? "").trim();
  const ownerEmail =
    ownerIdentifier.includes("@") && !ownerIdentifier.startsWith("@")
      ? ownerIdentifier.toLowerCase()
      : "";
  const directoryId = String(formData.get("directoryId") ?? "").trim() || null;
  if (name.length < 2) return { error: "Le nom du club est requis." };
  if (ownerIdentifier && !ownerEmail && !ownerIdentifier.startsWith("@")) {
    return { error: "Compte propriétaire invalide." };
  }

  const supabase = await createClient();

  const { data: clubId, error } = await supabase.rpc("admin_create_club", {
    p_name: name,
    p_owner_email: ownerEmail || null,
    p_max_teams: intOrNull(formData, "maxTeams"),
    p_max_players: intOrNull(formData, "maxPlayers"),
    p_max_staff: intOrNull(formData, "maxStaff"),
    p_ends_at: tsOrNull(formData, "endsAt"),
    p_auto_renew: String(formData.get("autoRenew") ?? "") === "on",
    p_quote_reference: String(formData.get("quoteReference") ?? "").trim() || null,
    p_notes: String(formData.get("notes") ?? "").trim() || null,
    p_directory_id: directoryId,
  });

  if (error || !clubId) {
    return { error: error?.message ?? "Échec de la création du club." };
  }
  const newClubId = clubId as string;

  // Regroupement : liste informative des clubs composant ce club (best-effort).
  const memberClubs = memberClubsFromForm(formData);
  if (memberClubs.length > 0) {
    await supabase.rpc("admin_set_club_member_clubs", {
      p_club_id: newClubId,
      p_member_clubs: memberClubs,
    });
  }

  // Send the owner invitation (best-effort: club is created regardless).
  if (ownerIdentifier) {
    await inviteOwner(supabase, newClubId, name, ownerIdentifier, locale);
  }

  revalidatePath(`/${locale}/admin/clubs`);
  redirect(`/${locale}/admin/clubs/${newClubId}`);
}

async function inviteOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  clubName: string,
  identifier: string,
  locale: string,
): Promise<ActionResult> {
  const { data: role } = await supabase
    .from("club_roles")
    .select("id, name")
    .eq("club_id", clubId)
    .eq("access_level", "full")
    .eq("is_system", true)
    .maybeSingle();
  if (!role) return { error: "Rôle propriétaire introuvable pour ce club." };

  const isEmail = identifier.includes("@") && !identifier.startsWith("@");
  const email = isEmail ? identifier.toLowerCase() : "";
  const { data: resolvedTarget, error: resolveError } = await supabase
    .rpc("resolve_invitation_target", { p_identifier: identifier })
    .maybeSingle<{
      user_id: string;
      email: string | null;
      username: string | null;
      full_name: string | null;
    }>();
  if (resolveError) return { error: resolveError.message };
  if (!isEmail && !resolvedTarget?.user_id) {
    return { error: "Aucun compte ne correspond à ce nom d'utilisateur." };
  }

  if (resolvedTarget?.user_id) {
    const { error: targetedErr } = await supabase.rpc(
      "create_targeted_staff_invitation",
      {
        p_club_id: clubId,
        p_target_user_id: resolvedTarget.user_id,
        p_email: resolvedTarget.email,
        p_role_id: role.id,
        p_team_ids: [],
        p_ttl_hours: 336,
      },
    );
    if (targetedErr) {
      return { error: targetedErr.message ?? "Échec de la création de l'invitation." };
    }
    await supabase
      .from("profiles")
      .update({ can_coach: true })
      .eq("id", resolvedTarget.user_id);
    return { ok: true };
  }

  if (!email) return { error: "Email invalide." };

  const { data: token, error: inviteErr } = await supabase.rpc("create_invitation", {
    p_club_id: clubId,
    p_email: email,
    p_role_id: role.id,
    p_team_ids: [],
    p_ttl_hours: 336, // 14 days for a club owner
  });
  if (inviteErr || !token) {
    return { error: inviteErr?.message ?? "Échec de la création de l'invitation." };
  }

  const url = `${getSiteUrl()}/${locale}/invite/${token as string}`;
  const tokenHash = createHash("sha256").update(token as string, "utf8").digest("hex");
  const { data: invitation } = await supabase
    .from("club_invitations")
    .select("id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!invitation) return { error: "Invitation introuvable après création." };

  const emailResult = await sendClubInvitationEmail(supabase, {
    invitationId: invitation.id,
    kind: "staff",
    locale,
    to: email,
    clubName,
    inviterName: "Grinta",
    roleName: role.name,
    playerName: null,
    teamName: null,
    acceptUrl: url,
    expiresAt: invitation.expires_at,
    brandColor: "#18181b",
  });

  if (!emailResult.ok) {
    return { error: `Invitation créée mais email non envoyé (${emailResult.reason}).` };
  }
  return { ok: true };
}

/**
 * Send (or re-send) the owner invitation email for an existing club. Useful when
 * a club was created without an owner email, or the first email failed.
 */
export async function inviteClubOwnerAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const clubId = String(formData.get("clubId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  const identifier = String(
    formData.get("identifier") ?? formData.get("email") ?? "",
  ).trim();
  if (!clubId) return { error: "Club manquant." };
  if (!identifier) return { error: "Compte ou email requis." };

  const supabase = await createClient();
  const { data: club } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", clubId)
    .maybeSingle();
  if (!club) return { error: "Club introuvable." };

  const result = await inviteOwner(supabase, clubId, club.name, identifier, locale);
  if (result.error) return result;

  revalidatePath(`/${locale}/admin/clubs/${clubId}`);
  return { ok: true };
}

export async function updateLicenseAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const clubId = String(formData.get("clubId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  if (!clubId) return { error: "Club manquant." };

  const status = String(formData.get("status") ?? "active");
  if (!["active", "suspended", "expired"].includes(status)) {
    return { error: "Statut invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_license", {
    p_club_id: clubId,
    p_max_teams: intOrNull(formData, "maxTeams"),
    p_max_players: intOrNull(formData, "maxPlayers"),
    p_max_staff: intOrNull(formData, "maxStaff"),
    p_status: status,
    p_auto_renew: String(formData.get("autoRenew") ?? "") === "on",
    p_ends_at: tsOrNull(formData, "endsAt"),
    p_quote_reference: String(formData.get("quoteReference") ?? "").trim() || null,
    p_notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/${locale}/admin/clubs/${clubId}`);
  return { ok: true };
}

/**
 * Met à jour la liste (informative) des clubs composant le regroupement. Aucun
 * effet fonctionnel — sert uniquement à s'y retrouver côté console admin.
 */
export async function updateClubMemberClubsAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const clubId = String(formData.get("clubId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  if (!clubId) return { error: "Club manquant." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_club_member_clubs", {
    p_club_id: clubId,
    p_member_clubs: memberClubsFromForm(formData),
  });
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/admin/clubs/${clubId}`);
  return { ok: true };
}

export async function setLicenseStatusAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const clubId = String(formData.get("clubId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  const status = String(formData.get("status") ?? "");
  if (!clubId || !["active", "suspended", "expired"].includes(status)) {
    return { error: "Paramètres invalides." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_license_status", {
    p_club_id: clubId,
    p_status: status,
  });
  if (error) return { error: error.message };
  revalidatePath(`/${locale}/admin/clubs/${clubId}`);
  return { ok: true };
}

export async function archiveClubAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const clubId = String(formData.get("clubId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  if (!clubId) return { error: "Club manquant." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_archive_club", { p_club_id: clubId });
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/admin/clubs`);
  revalidatePath(`/${locale}/admin/clubs/${clubId}`);
  return { ok: true };
}

export async function restoreClubAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const clubId = String(formData.get("clubId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  if (!clubId) return { error: "Club manquant." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_restore_club", { p_club_id: clubId });
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/admin/clubs`);
  revalidatePath(`/${locale}/admin/clubs/${clubId}`);
  return { ok: true };
}

/**
 * Irreversible hard delete (cascades through every club_id FK). The caller must
 * re-type the exact club name; the RPC re-checks it server-side. On success we
 * redirect back to the clubs list since the detail page no longer exists.
 */
export async function deleteClubAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const clubId = String(formData.get("clubId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  const confirmName = String(formData.get("confirmName") ?? "");
  if (!clubId) return { error: "Club manquant." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_club", {
    p_club_id: clubId,
    p_confirm_name: confirmName,
  });
  if (error) {
    if (error.message.includes("name_mismatch")) {
      return { error: "Le nom saisi ne correspond pas au club." };
    }
    return { error: error.message };
  }

  revalidatePath(`/${locale}/admin/clubs`);
  redirect(`/${locale}/admin/clubs`);
}

export async function addPlatformAdminAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const locale = String(formData.get("locale") ?? "fr");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { error: "Email invalide." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_platform_admin", { p_email: email });
  if (error) {
    if (error.message.includes("user_not_found")) {
      return { error: "Aucun compte avec cet email. La personne doit d'abord créer un compte Grinta." };
    }
    return { error: error.message };
  }
  revalidatePath(`/${locale}/admin/admins`);
  return { ok: true };
}

export async function removePlatformAdminAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const locale = String(formData.get("locale") ?? "fr");
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Utilisateur manquant." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_platform_admin", { p_user_id: userId });
  if (error) {
    if (error.message.includes("cannot_remove_self")) {
      return { error: "Tu ne peux pas te retirer toi-même." };
    }
    return { error: error.message };
  }
  revalidatePath(`/${locale}/admin/admins`);
  return { ok: true };
}
