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
  if (error) {
    if (error.message.includes("club_is_group_member")) {
      return { error: "Ce club appartient à un regroupement. Retire-le du regroupement avant de l'archiver." };
    }
    return { error: error.message };
  }

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
    if (error.message.includes("club_is_group_member")) {
      return { error: "Ce club appartient à un regroupement. Retire-le du regroupement avant de le supprimer." };
    }
    if (error.message.includes("name_mismatch")) {
      return { error: "Le nom saisi ne correspond pas au club." };
    }
    return { error: error.message };
  }

  revalidatePath(`/${locale}/admin/clubs`);
  redirect(`/${locale}/admin/clubs`);
}

// --- Regroupements (groupements) --------------------------------------------

function clubIdsFromForm(formData: FormData): string[] {
  try {
    const parsed = JSON.parse(String(formData.get("memberClubIds") ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((v): v is string => typeof v === "string"))];
  } catch {
    return [];
  }
}

function clubGroupError(msg: string): string {
  if (msg.includes("invalid_member_count")) return "Nombre de clubs invalide (2 max chez les hommes actifs, 6 sinon).";
  if (msg.includes("member_already_in_group")) return "Un club sélectionné appartient déjà à un regroupement de cette catégorie.";
  if (msg.includes("invalid_category")) return "Catégorie de regroupement invalide.";
  if (msg.includes("subcategory_required")) return "Choisis une sous-catégorie (seniors ou juniors).";
  return msg;
}

const GROUP_CATEGORIES = ["hommes_actifs", "femmes", "seniors", "juniors"] as const;

function groupCategoryFromForm(formData: FormData): string {
  return String(formData.get("category") ?? "");
}

function groupSubcategoryFromForm(formData: FormData, category: string): string | null {
  if (category !== "seniors" && category !== "juniors") return null;
  const sub = String(formData.get("subcategory") ?? "").trim();
  return sub === "" ? null : sub;
}

export async function createClubGroupAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const locale = String(formData.get("locale") ?? "fr");
  const name = String(formData.get("name") ?? "").trim();
  const memberClubIds = clubIdsFromForm(formData);
  const category = groupCategoryFromForm(formData);
  const subcategory = groupSubcategoryFromForm(formData, category);
  if (name.length < 2) return { error: "Le nom du regroupement est requis." };
  if (!GROUP_CATEGORIES.includes(category as (typeof GROUP_CATEGORIES)[number])) {
    return { error: "Catégorie de regroupement invalide." };
  }

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("admin_create_club_group", {
    p_name: name,
    p_member_club_ids: memberClubIds,
    p_category: category,
    p_subcategory: subcategory,
    p_max_teams: intOrNull(formData, "maxTeams"),
    p_max_players: intOrNull(formData, "maxPlayers"),
    p_max_staff: intOrNull(formData, "maxStaff"),
  });
  if (error || !groupId) return { error: clubGroupError(error?.message ?? "Échec de la création.") };

  revalidatePath(`/${locale}/admin/regroupements`);
  revalidatePath(`/${locale}/admin/clubs`);
  redirect(`/${locale}/admin/regroupements/${groupId as string}`);
}

export async function updateClubGroupAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const locale = String(formData.get("locale") ?? "fr");
  const groupId = String(formData.get("groupId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const memberClubIds = clubIdsFromForm(formData);
  const category = groupCategoryFromForm(formData);
  const subcategory = groupSubcategoryFromForm(formData, category);
  if (!groupId) return { error: "Regroupement manquant." };
  if (name.length < 2) return { error: "Le nom du regroupement est requis." };
  if (!GROUP_CATEGORIES.includes(category as (typeof GROUP_CATEGORIES)[number])) {
    return { error: "Catégorie de regroupement invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_club_group", {
    p_group_club_id: groupId,
    p_name: name,
    p_member_club_ids: memberClubIds,
    p_category: category,
    p_subcategory: subcategory,
    p_max_teams: intOrNull(formData, "maxTeams"),
    p_max_players: intOrNull(formData, "maxPlayers"),
    p_max_staff: intOrNull(formData, "maxStaff"),
  });
  if (error) return { error: clubGroupError(error.message) };

  revalidatePath(`/${locale}/admin/regroupements`);
  revalidatePath(`/${locale}/admin/regroupements/${groupId}`);
  revalidatePath(`/${locale}/admin/clubs`);
  return { ok: true };
}

export async function archiveClubGroupAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const locale = String(formData.get("locale") ?? "fr");
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) return { error: "Regroupement manquant." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_archive_club_group", { p_group_club_id: groupId });
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/admin/regroupements`);
  revalidatePath(`/${locale}/admin/clubs`);
  redirect(`/${locale}/admin/regroupements`);
}

export async function deleteClubGroupAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const locale = String(formData.get("locale") ?? "fr");
  const groupId = String(formData.get("groupId") ?? "");
  const confirmName = String(formData.get("confirmName") ?? "");
  if (!groupId) return { error: "Regroupement manquant." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_club_group", {
    p_group_club_id: groupId,
    p_confirm_name: confirmName,
    p_allow_data_delete: String(formData.get("confirmDataDeletion") ?? "") === "on",
  });
  if (error) {
    if (error.message.includes("name_mismatch")) {
      return { error: "Le nom saisi ne correspond pas au regroupement." };
    }
    if (error.message.includes("group_not_empty")) {
      return { error: "Ce regroupement contient encore des données. Confirme la suppression complète pour continuer." };
    }
    return { error: error.message };
  }

  revalidatePath(`/${locale}/admin/regroupements`);
  revalidatePath(`/${locale}/admin/clubs`);
  redirect(`/${locale}/admin/regroupements`);
}

export async function inviteClubGroupResponsibleAction(formData: FormData): Promise<ActionResult> {
  if (!(await guard())) return { error: "forbidden" };

  const locale = String(formData.get("locale") ?? "fr");
  const groupId = String(formData.get("groupId") ?? "");
  const identifier = String(formData.get("identifier") ?? "").trim();
  const scope = String(formData.get("scope") ?? "group");
  if (!groupId) return { error: "Regroupement manquant." };
  if (!identifier) return { error: "Compte ou email requis." };

  const supabase = await createClient();
  const { data: group } = await supabase
    .from("clubs")
    .select("id, name, is_group")
    .eq("id", groupId)
    .maybeSingle<{ id: string; name: string; is_group: boolean }>();
  if (!group?.is_group) return { error: "Regroupement introuvable." };

  const targets = [{ id: group.id, name: group.name }];
  if (scope === "group_and_members") {
    const { data: memberRows, error: membersError } = await supabase
      .from("club_group_members")
      .select("member_club_id")
      .eq("group_club_id", groupId)
      .returns<{ member_club_id: string }[]>();
    if (membersError) return { error: membersError.message };
    const memberIds = (memberRows ?? []).map((m) => m.member_club_id);
    if (memberIds.length > 0) {
      const { data: clubs, error: clubsError } = await supabase
        .from("clubs")
        .select("id, name")
        .in("id", memberIds)
        .returns<{ id: string; name: string }[]>();
      if (clubsError) return { error: clubsError.message };
      targets.push(...(clubs ?? []));
    }
  }

  for (const target of targets) {
    const result = await inviteOwner(supabase, target.id, target.name, identifier, locale);
    if (result.error) return { error: `${target.name}: ${result.error}` };
  }

  revalidatePath(`/${locale}/admin/regroupements/${groupId}`);
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
