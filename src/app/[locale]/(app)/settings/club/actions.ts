"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentMembership } from "@/lib/club/context";
import { canManageClub } from "@/lib/club/types";
import type { AccessLevel } from "@/lib/club/types";

type InviteResult =
  | { ok: true; token: string; url: string }
  | { error: string };

export async function inviteMemberAction(formData: FormData): Promise<InviteResult> {
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
    return { error: error?.message ?? "Échec de la création de l'invitation." };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = origin
    ? `${origin}/invite/${token as string}`
    : `/invite/${token as string}`;

  revalidatePath("/settings/club");
  return { ok: true, token: token as string, url };
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

  const members = (membersRes.data as RawMember[] | null ?? []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    created_at: m.created_at,
    profiles: unwrap(m.profiles),
    club_roles: unwrap(m.club_roles),
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
