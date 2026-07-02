"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentMembership } from "@/lib/club/context";
import { getSiteUrl } from "@/lib/site-url";
import { canManageClub } from "@/lib/club/types";
import { sendClubInvitationEmail } from "@/lib/email/invitations";
import type { AccessLevel, ClubThemeMode } from "@/lib/club/types";

type InviteResult =
  | {
      ok: true;
      token: string | null;
      url: string | null;
      emailSent: boolean;
      direct: boolean;
      targetLabel?: string;
      emailError?: string;
    }
  | { error: string };

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function cleanColor(value: FormDataEntryValue | null, fallback: string): string {
  const color = String(value ?? "").trim();
  return HEX_COLOR_RE.test(color) ? color : fallback;
}

export async function updateClubIdentityAction(formData: FormData) {
  const name = String(formData.get("clubName") ?? "").trim();
  const membership = await resolveCurrentMembership();
  const entityLabel = membership?.is_group ? "regroupement" : "club";
  if (name.length < 2) {
    return { error: `Le nom du ${entityLabel} doit contenir au moins 2 caractères.` };
  }
  if (name.length > 80) {
    return { error: `Le nom du ${entityLabel} est trop long.` };
  }

  const themeMode = String(formData.get("themeMode") ?? "day") as ClubThemeMode;
  if (themeMode !== "day" && themeMode !== "night") {
    return { error: "Mode invalide." };
  }

  if (!membership || !canManageClub(membership.access_level)) {
    return { error: "Action interdite." };
  }

  const supabase = await createClient();

  // Logos du regroupement : liste ordonnée d'URLs publiques (bucket `club-logos`).
  // Le formulaire envoie `existingLogos` (JSON des URLs conservées, dans l'ordre)
  // et 0..N nouveaux fichiers `logoFile`. Le résultat = conservés + nouveaux
  // uploadés, cappé à 6. `logo_url` reste le logo primaire (= logos[0]).
  const MAX_LOGOS = 6;
  const allowedExt: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
  };

  let keptLogos: string[] = [];
  try {
    const raw = String(formData.get("existingLogos") ?? "[]");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      keptLogos = parsed.filter((u): u is string => typeof u === "string");
    }
  } catch {
    keptLogos = [];
  }

  const newFiles = formData
    .getAll("logoFile")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const uploadedLogos: string[] = [];
  for (const file of newFiles) {
    const ext = allowedExt[file.type];
    if (!ext) return { error: "Le logo doit être un PNG ou un JPEG." };
    if (file.size > 2 * 1024 * 1024) {
      return { error: "Le logo ne doit pas dépasser 2 Mo." };
    }
    const path = `${membership.club_id}/logo-${Date.now()}-${uploadedLogos.length}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("club-logos")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (uploadErr) return { error: uploadErr.message };
    const { data: pub } = supabase.storage.from("club-logos").getPublicUrl(path);
    uploadedLogos.push(pub.publicUrl);
  }

  const logos = [...keptLogos, ...uploadedLogos].slice(0, MAX_LOGOS);

  const { error } = await supabase
    .from("clubs")
    .update({
      name,
      logos,
      logo_url: logos[0] ?? null,
      theme_mode: themeMode,
      theme_primary_color: cleanColor(
        formData.get("primaryColor"),
        membership.theme_primary_color,
      ),
    })
    .eq("id", membership.club_id);

  if (error) return { error: error.message };
  revalidatePath("/settings/club");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function inviteMemberAction(formData: FormData): Promise<InviteResult> {
  const locale = String(formData.get("locale") ?? "fr");
  const identifier = String(
    formData.get("identifier") ?? formData.get("email") ?? "",
  ).trim();
  const isEmail = identifier.includes("@") && !identifier.startsWith("@");
  const email = isEmail ? identifier.toLowerCase() : "";
  const roleId = String(formData.get("roleId") ?? "");
  const teamIdsRaw = formData.getAll("teamIds").map(String).filter(Boolean);

  if (!identifier) return { error: "Compte ou email requis." };
  if (isEmail && !email.includes("@")) return { error: "Email invalide." };
  if (!roleId) return { error: "Rôle requis." };

  const membership = await resolveCurrentMembership();
  if (!membership) return { error: "Aucun club courant." };
  if (!canManageClub(membership.access_level)) {
    return { error: "Tu n'as pas le droit d'inviter." };
  }

  const supabase = await createClient();

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
    const { error: targetedError } = await supabase.rpc(
      "create_targeted_staff_invitation",
      {
        p_club_id: membership.club_id,
        p_target_user_id: resolvedTarget.user_id,
        p_email: resolvedTarget.email,
        p_role_id: roleId,
        p_team_ids: teamIdsRaw,
        p_ttl_hours: 168,
      },
    );
    if (targetedError) {
      if (targetedError.message?.includes("staff_quota_reached")) {
        return {
          error:
            "Quota de membres du staff atteint pour la licence de ce club. Contacte l'administrateur pour l'étendre.",
        };
      }
      return {
        error: targetedError.message ?? "Échec de la création de l'invitation.",
      };
    }
    await supabase
      .from("profiles")
      .update({ can_coach: true })
      .eq("id", resolvedTarget.user_id);

    revalidatePath("/settings/club");
    return {
      ok: true,
      token: null,
      url: null,
      emailSent: false,
      direct: true,
      targetLabel: resolvedTarget.username
        ? `@${resolvedTarget.username}`
        : resolvedTarget.email ?? undefined,
    };
  }

  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_club_id: membership.club_id,
    p_email: email,
    p_role_id: roleId,
    p_team_ids: teamIdsRaw,
    p_ttl_hours: 168,
  });

  if (error || !token) {
    if (error?.message?.includes("rate_limited")) {
      return { error: "Trop d'invitations récentes pour cet email. Réessaie plus tard." };
    }
    if (error?.message?.includes("staff_quota_reached")) {
      return {
        error:
          "Quota de membres du staff atteint pour la licence de ce club. Contacte l'administrateur pour l'étendre.",
      };
    }
    return { error: error?.message ?? "Échec de la création de l'invitation." };
  }

  const plainToken = token as string;
  const url = `${getSiteUrl()}/${locale}/invite/${plainToken}`;
  const tokenHash = createHash("sha256").update(plainToken, "utf8").digest("hex");

  const { data: invitation } = await supabase
    .from("club_invitations")
    .select("id, expires_at, role_id, team_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invitation) {
    return {
      ok: true,
      token: plainToken,
      url,
      emailSent: false,
      direct: false,
      emailError: "invitation_not_found_after_insert",
    };
  }

  const [{ data: role }, { data: profile }] = await Promise.all([
    supabase
      .from("club_roles")
      .select("name")
      .eq("id", roleId)
      .maybeSingle(),
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { data: null };
      return supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
    })(),
  ]);

  const emailResult = await sendClubInvitationEmail(supabase, {
    invitationId: invitation.id,
    kind: "staff",
    locale,
    to: email,
    clubName: membership.club_name,
    inviterName: profile?.full_name ?? null,
    roleName: role?.name ?? null,
    playerName: null,
    teamName: null,
    acceptUrl: url,
    expiresAt: invitation.expires_at,
    brandColor: membership.theme_primary_color,
  });

  revalidatePath("/settings/club");
  return {
    ok: true,
    token: plainToken,
    url,
    emailSent: emailResult.ok,
    direct: false,
    ...(emailResult.ok ? {} : { emailError: emailResult.reason }),
  };
}

export async function setClubGroupShareAction(formData: FormData) {
  const groupClubId = String(formData.get("groupClubId") ?? "");
  const shareType = String(formData.get("shareType") ?? "suivi_joueur");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  if (!groupClubId) return { error: "Regroupement manquant." };

  const membership = await resolveCurrentMembership();
  if (!membership || !canManageClub(membership.access_level)) {
    return { error: "Action interdite." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_club_group_share", {
    p_group_club_id: groupClubId,
    p_member_club_id: membership.club_id,
    p_share_type: shareType,
    p_enabled: enabled,
  });
  if (error) return { error: error.message };
  revalidatePath("/settings/club");
  return { ok: true as const };
}

export async function revokeInvitationAction(formData: FormData) {
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!invitationId) return { error: "ID manquant." };

  const membership = await resolveCurrentMembership();
  if (!membership || !canManageClub(membership.access_level)) {
    return { error: "Action interdite." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("club_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("club_id", membership.club_id);

  if (error) return { error: error.message };
  revalidatePath("/settings/club");
  return { ok: true as const };
}

export async function removeMemberAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Utilisateur manquant." };

  const membership = await resolveCurrentMembership();
  if (!membership || !canManageClub(membership.access_level)) {
    return { error: "Action interdite." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && userId === user.id) {
    return { error: "Tu ne peux pas te retirer toi-même du club." };
  }

  const { error } = await supabase
    .from("club_memberships")
    .delete()
    .eq("club_id", membership.club_id)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/settings/club");
  return { ok: true as const };
}

/**
 * Update an existing member's role and/or team assignments (e.g. add U16 to a
 * coach already on U15). Atomic + self-guarded server-side via the RPC.
 */
export async function updateMemberAction(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const membershipId = String(formData.get("membershipId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  const teamIds = formData.getAll("teamIds").map(String).filter(Boolean);
  if (!membershipId) return { error: "Membre manquant." };
  if (!roleId) return { error: "Rôle requis." };

  const membership = await resolveCurrentMembership();
  if (!membership || !canManageClub(membership.access_level)) {
    return { error: "Action interdite." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_membership_assignment", {
    p_membership_id: membershipId,
    p_role_id: roleId,
    p_team_ids: teamIds,
  });

  if (error) {
    if (error.message.includes("team_role_requires_team")) {
      return { error: "Ce rôle nécessite au moins une équipe." };
    }
    if (error.message.includes("team_not_in_club")) {
      return { error: "Une équipe sélectionnée n'appartient pas au club." };
    }
    return { error: error.message };
  }

  revalidatePath("/settings/club");
  return { ok: true as const };
}

type CreateRoleInput = {
  name: string;
  accessLevel: AccessLevel;
};

export async function createRoleAction(formData: FormData) {
  const input: CreateRoleInput = {
    name: String(formData.get("name") ?? "").trim(),
    accessLevel: String(formData.get("accessLevel") ?? "") as AccessLevel,
  };
  if (!input.name) return { error: "Nom requis." };
  if (!["full", "extended", "team", "team_readonly"].includes(input.accessLevel)) {
    return { error: "Niveau d'accès invalide." };
  }

  const membership = await resolveCurrentMembership();
  if (!membership || !canManageClub(membership.access_level)) {
    return { error: "Action interdite." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("club_roles").insert({
    club_id: membership.club_id,
    name: input.name,
    access_level: input.accessLevel,
    is_system: false,
  });

  if (error) return { error: error.message };
  revalidatePath("/settings/club");
  return { ok: true as const };
}

export async function deleteRoleAction(formData: FormData) {
  const roleId = String(formData.get("roleId") ?? "");
  if (!roleId) return { error: "ID manquant." };

  const membership = await resolveCurrentMembership();
  if (!membership || !canManageClub(membership.access_level)) {
    return { error: "Action interdite." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("club_roles")
    .delete()
    .eq("id", roleId)
    .eq("club_id", membership.club_id)
    .eq("is_system", false);

  if (error) return { error: error.message };
  revalidatePath("/settings/club");
  return { ok: true as const };
}

// Helper used by the page when rendering the invite form: lists teams + roles.
type RawMember = {
  id: string;
  user_id: string;
  created_at: string;
  profiles: { full_name: string | null }[] | { full_name: string | null } | null;
  club_roles:
    | { id: string; name: string; access_level: AccessLevel }[]
    | { id: string; name: string; access_level: AccessLevel }
    | null;
};

type RawInvitation = {
  id: string;
  email: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  club_roles: { name: string; access_level: AccessLevel }[] | { name: string; access_level: AccessLevel } | null;
};

type RawClub = {
  name: string;
  is_group: boolean;
  logo_url: string | null;
  logos: string[] | null;
  theme_mode: ClubThemeMode;
  theme_primary_color: string;
  theme_secondary_color: string;
  theme_night_primary_color: string;
  theme_night_secondary_color: string;
};

function unwrap<T>(value: T[] | T | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function loadClubSettingsData() {
  const membership = await resolveCurrentMembership();
  if (!membership) return null;

  const supabase = await createClient();

  const [rolesRes, teamsRes, membersRes, invitesRes] = await Promise.all([
    supabase
      .from("club_roles")
      .select("id, name, access_level, is_system")
      .eq("club_id", membership.club_id)
      .order("is_system", { ascending: false })
      .order("name"),
    supabase
      .from("teams")
      .select("id, name, season")
      .eq("club_id", membership.club_id)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("club_memberships")
      .select(
        `id, user_id, created_at,
         profiles!inner(full_name),
         club_roles!inner(id, name, access_level)`,
      )
      .eq("club_id", membership.club_id),
    supabase
      .from("club_invitations")
      .select(
        `id, email, expires_at, accepted_at, created_at,
         club_roles!inner(name, access_level)`,
      )
      .eq("club_id", membership.club_id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const { data: club } = await supabase
    .from("clubs")
    .select(
      "name, is_group, logo_url, logos, theme_mode, theme_primary_color, theme_secondary_color, theme_night_primary_color, theme_night_secondary_color",
    )
    .eq("id", membership.club_id)
    .single<RawClub>();

  // Rattachement membre → équipes (team_memberships) pour le filtre « par équipe ».
  const membershipIds = (membersRes.data as RawMember[] | null ?? []).map((m) => m.id);
  const { data: teamMembershipRows } = membershipIds.length
    ? await supabase
        .from("team_memberships")
        .select("team_id, membership_id")
        .in("membership_id", membershipIds)
    : { data: [] as { team_id: string; membership_id: string }[] };
  const teamIdsByMember = new Map<string, string[]>();
  for (const row of teamMembershipRows ?? []) {
    const list = teamIdsByMember.get(row.membership_id) ?? [];
    list.push(row.team_id);
    teamIdsByMember.set(row.membership_id, list);
  }

  const members = (membersRes.data as RawMember[] | null ?? []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    created_at: m.created_at,
    profiles: unwrap(m.profiles),
    club_roles: unwrap(m.club_roles),
    team_ids: teamIdsByMember.get(m.id) ?? [],
  }));

  const invitations = (invitesRes.data as RawInvitation[] | null ?? []).map(
    (i) => ({
      id: i.id,
      email: i.email,
      expires_at: i.expires_at,
      accepted_at: i.accepted_at,
      created_at: i.created_at,
      club_roles: unwrap(i.club_roles),
    }),
  );

  // Regroupements dont ce club est membre + état du partage (suivi joueur). C'est
  // le CLUB MEMBRE qui décide de ce qu'il dévoile (rivalité-aware). On n'affiche
  // rien quand le contexte courant est lui-même un regroupement.
  type GroupShare = {
    groupClubId: string;
    groupName: string;
    category: string | null;
    subcategory: string | null;
    sharedSuivi: boolean;
  };
  let groupShares: GroupShare[] = [];
  if (!membership.is_group) {
    const { data: links } = await supabase
      .from("club_group_members")
      .select("group_club_id")
      .eq("member_club_id", membership.club_id);
    const groupIds = [...new Set((links ?? []).map((l) => l.group_club_id as string))];
    if (groupIds.length > 0) {
      const [{ data: groupClubs }, { data: shares }] = await Promise.all([
        supabase
          .from("clubs")
          .select("id, name, group_category, group_subcategory")
          .in("id", groupIds),
        supabase
          .from("club_group_shares")
          .select("group_club_id, share_type")
          .eq("member_club_id", membership.club_id)
          .in("group_club_id", groupIds),
      ]);
      const sharedSet = new Set(
        ((shares ?? []) as { group_club_id: string; share_type: string }[])
          .filter((s) => s.share_type === "suivi_joueur")
          .map((s) => s.group_club_id),
      );
      groupShares = (
        (groupClubs ?? []) as {
          id: string;
          name: string;
          group_category: string | null;
          group_subcategory: string | null;
        }[]
      ).map((g) => ({
        groupClubId: g.id,
        groupName: g.name,
        category: g.group_category,
        subcategory: g.group_subcategory,
        sharedSuivi: sharedSet.has(g.id),
      }));
    }
  }

  const normalizedLogos = (logo_url: string | null, logos: string[] | null) =>
    logos && logos.length > 0 ? logos : logo_url ? [logo_url] : [];

  return {
    groupShares,
    membership,
    clubIdentity: club
      ? { ...club, logos: normalizedLogos(club.logo_url, club.logos) }
      : {
          name: membership.club_name,
          is_group: membership.is_group,
          logo_url: membership.logo_url,
          logos: membership.logos,
          theme_mode: membership.theme_mode,
          theme_primary_color: membership.theme_primary_color,
          theme_secondary_color: membership.theme_secondary_color,
          theme_night_primary_color: membership.theme_night_primary_color,
          theme_night_secondary_color: membership.theme_night_secondary_color,
        },
    roles: (rolesRes.data ?? []) as {
      id: string;
      name: string;
      access_level: AccessLevel;
      is_system: boolean;
    }[],
    teams: (teamsRes.data ?? []) as {
      id: string;
      name: string;
      season: string | null;
    }[],
    members,
    invitations,
  };
}
