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
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  if (name.length < 2) return { error: "Le nom du club est requis." };
  if (ownerEmail && !ownerEmail.includes("@")) return { error: "Email propriétaire invalide." };

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
  });

  if (error || !clubId) {
    return { error: error?.message ?? "Échec de la création du club." };
  }
  const newClubId = clubId as string;

  // Send the owner invitation (best-effort: club is created regardless).
  if (ownerEmail) {
    await inviteOwner(supabase, newClubId, name, ownerEmail, locale);
  }

  revalidatePath(`/${locale}/admin/clubs`);
  redirect(`/${locale}/admin/clubs/${newClubId}`);
}

async function inviteOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  clubName: string,
  email: string,
  locale: string,
): Promise<void> {
  const { data: role } = await supabase
    .from("club_roles")
    .select("id, name")
    .eq("club_id", clubId)
    .eq("access_level", "full")
    .eq("is_system", true)
    .maybeSingle();
  if (!role) return;

  const { data: token } = await supabase.rpc("create_invitation", {
    p_club_id: clubId,
    p_email: email,
    p_role_id: role.id,
    p_team_ids: [],
    p_ttl_hours: 336, // 14 days for a club owner
  });
  if (!token) return;

  const url = `${getSiteUrl()}/${locale}/invite/${token as string}`;
  const tokenHash = createHash("sha256").update(token as string, "utf8").digest("hex");
  const { data: invitation } = await supabase
    .from("club_invitations")
    .select("id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!invitation) return;

  await sendClubInvitationEmail(supabase, {
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
