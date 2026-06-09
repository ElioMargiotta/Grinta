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
  | { ok: true; token: string; url: string; emailSent: boolean; emailError?: string }
  | { error: string };

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function cleanColor(value: FormDataEntryValue | null, fallback: string): string {
  const color = String(value ?? "").trim();
  return HEX_COLOR_RE.test(color) ? color : fallback;
}

export async function updateClubIdentityAction(formData: FormData) {
  const name = String(formData.get("clubName") ?? "").trim();
  if (name.length < 2) {
    return { error: "Le nom du club doit contenir au moins 2 caractères." };
  }
  if (name.length > 80) {
    return { error: "Le nom du club est trop long." };
  }

  const themeMode = String(formData.get("themeMode") ?? "day") as ClubThemeMode;
  if (themeMode !== "day" && themeMode !== "night") {
    return { error: "Mode invalide." };
  }

  const membership = await resolveCurrentMembership();
  if (!membership || !canManageClub(membership.access_level)) {
    return { error: "Action interdite." };
  }

  const supabase = await createClient();

  // Logo : import de fichier PNG/JPEG → bucket Storage `club-logos`. À défaut on
  // garde l'existant, ou on le retire si l'utilisateur l'a demandé.
  const logoUpdate: { logo_url?: string | null } = {};
  const removeLogo = String(formData.get("removeLogo") ?? "") === "1";
  const logoFile = formData.get("logoFile");
  if (logoFile instanceof File && logoFile.size > 0) {
    const allowedExt: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
    };
    const ext = allowedExt[logoFile.type];
    if (!ext) return { error: "Le logo doit être un PNG ou un JPEG." };
    if (logoFile.size > 2 * 1024 * 1024) {
      return { error: "Le logo ne doit pas dépasser 2 Mo." };
    }
    const path = `${membership.club_id}/logo-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("club-logos")
      .upload(path, logoFile, { contentType: logoFile.type, upsert: true });
    if (uploadErr) return { error: uploadErr.message };
    const { data: pub } = supabase.storage.from("club-logos").getPublicUrl(path);
    logoUpdate.logo_url = pub.publicUrl;
  } else if (removeLogo) {
    logoUpdate.logo_url = null;
  }

  const { error } = await supabase
    .from("clubs")
    .update({
      name,
      ...logoUpdate,
      theme_mode: themeMode,
      theme_primary_color: cleanColor(
        formData.get("primaryColor"),
        membership.theme_primary_color,
      ),
      theme_secondary_color: cleanColor(
        formData.get("secondaryColor"),
        membership.theme_secondary_color,
      ),
      theme_night_primary_color: cleanColor(
        formData.get("nightPrimaryColor"),
        membership.theme_night_primary_color,
      ),
      theme_night_secondary_color: cleanColor(
        formData.get("nightSecondaryColor"),
        membership.theme_night_secondary_color,
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
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleId = String(formData.get("roleId") ?? "");
  const teamIdsRaw = formData.getAll("teamIds").map(String).filter(Boolean);

  if (!email || !email.includes("@")) return { error: "Email invalide." };
  if (!roleId) return { error: "Rôle requis." };

  const membership = await resolveCurrentMembership();
  if (!membership) return { error: "Aucun club courant." };
  if (!canManageClub(membership.access_level)) {
    return { error: "Tu n'as pas le droit d'inviter." };
  }

  const supabase = await createClient();
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
    ...(emailResult.ok ? {} : { emailError: emailResult.reason }),
  };
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
  logo_url: string | null;
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
      "name, logo_url, theme_mode, theme_primary_color, theme_secondary_color, theme_night_primary_color, theme_night_secondary_color",
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

  return {
    membership,
    clubIdentity: club ?? {
      name: membership.club_name,
      logo_url: membership.logo_url,
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
