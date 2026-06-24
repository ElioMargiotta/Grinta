"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentMembership } from "@/lib/club/context";
import { resolveCurrentSeasonLabel } from "@/lib/club/season";
import { licenseErrorMessage } from "@/lib/license/types";

export async function createTeamAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const ageGroup = String(formData.get("ageGroup") ?? "").trim() || null;
  const locale = String(formData.get("locale") ?? "fr");

  if (!name) return { error: "Name is required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const membership = await resolveCurrentMembership();
  if (!membership) redirect(`/${locale}/onboarding/club`);

  // Une équipe est créée DANS la saison active (vue par saison). Le millésime
  // n'est plus saisi à la main : il suit le sélecteur de saison de la Topbar.
  const season = await resolveCurrentSeasonLabel();

  // Direct RLS-checked INSERT on teams hits a Supabase env quirk where the
  // WITH CHECK evaluates correctly in isolation but PG still rejects. Route
  // through the SECURITY DEFINER create_team RPC instead. We MUST pass the
  // currently selected club_id — the RPC has no access to the cookie that
  // drives the ClubSwitcher, and would otherwise silently pick the oldest
  // full-access membership.
  const { data: teamId, error } = await supabase.rpc("create_team", {
    p_club_id: membership.club_id,
    p_name: name,
    p_season: season,
    p_age_group: ageGroup,
  });

  if (error) return { error: licenseErrorMessage(error.message) };

  // Rend l'équipe visible dans la saison active (table d'appartenance). Sans
  // cette ligne, la nouvelle équipe n'apparaîtrait dans aucune saison.
  const { error: tsError } = await supabase
    .from("team_seasons")
    .insert({ team_id: teamId, season, club_id: membership.club_id });
  if (tsError) return { error: tsError.message };

  revalidatePath(`/${locale}/teams`);
  redirect(`/${locale}/teams/${teamId}`);
}

export async function updateTeamAction(formData: FormData): Promise<{ error?: string }> {
  const teamId = String(formData.get("teamId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const season = String(formData.get("season") ?? "").trim();
  const ageGroup = String(formData.get("ageGroup") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const photoUrl = String(formData.get("photoUrl") ?? "").trim();
  const locale = String(formData.get("locale") ?? "fr");

  if (!teamId || !name) return { error: "Missing fields" };
  if (photoUrl) {
    try {
      const url = new URL(photoUrl);
      if (url.protocol !== "https:") {
        return { error: "La photo doit être une URL https." };
      }
    } catch {
      return { error: "URL de photo invalide." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.rpc("update_team", {
    p_team_id: teamId,
    p_name: name,
    p_season: season || null,
    p_age_group: ageGroup || null,
    p_description: description || null,
    p_photo_url: photoUrl || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/teams/${teamId}`);
  revalidatePath(`/${locale}/teams`);
  return {};
}

export async function archiveTeamAction(formData: FormData): Promise<void> {
  const teamId = String(formData.get("teamId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  if (!teamId) throw new Error("Missing team id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.rpc("archive_team", { p_team_id: teamId });
  if (error) throw new Error(error.message);

  revalidatePath(`/${locale}/teams`);
  redirect(`/${locale}/teams`);
}

export async function restoreTeamAction(formData: FormData): Promise<void> {
  const teamId = String(formData.get("teamId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  if (!teamId) throw new Error("Missing team id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.rpc("restore_team", { p_team_id: teamId });
  if (error) throw new Error(error.message);

  revalidatePath(`/${locale}/teams`);
  revalidatePath(`/${locale}/teams/archived`);
  redirect(`/${locale}/teams/${teamId}`);
}

export async function permanentlyDeleteTeamAction(
  formData: FormData,
): Promise<void> {
  const teamId = String(formData.get("teamId") ?? "");
  const locale = String(formData.get("locale") ?? "fr");
  if (!teamId) throw new Error("Missing team id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.rpc("delete_team_permanently", {
    p_team_id: teamId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/${locale}/teams`);
  revalidatePath(`/${locale}/teams/archived`);
  redirect(`/${locale}/teams/archived`);
}

