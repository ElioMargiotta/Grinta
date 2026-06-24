import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ClubMembership } from "./types";

type Row = {
  club_id: string;
  role_id: string;
  clubs: {
    name: string;
    logo_url: string | null;
    theme_mode: ClubMembership["theme_mode"];
    theme_primary_color: string;
    theme_secondary_color: string;
    theme_night_primary_color: string;
    theme_night_secondary_color: string;
  } | null;
  club_roles: {
    name: string;
    access_level: ClubMembership["access_level"];
  } | null;
};

export const getMyMemberships = cache(async (): Promise<ClubMembership[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("club_memberships")
    .select(
      `club_id, role_id,
       clubs!inner(name, logo_url, theme_mode, theme_primary_color, theme_secondary_color, theme_night_primary_color, theme_night_secondary_color),
       club_roles!inner(name, access_level)`,
    )
    .eq("user_id", user.id)
    .returns<Row[]>();

  if (error || !data) return [];

  return data
    .filter((r): r is Row & { clubs: NonNullable<Row["clubs"]>; club_roles: NonNullable<Row["club_roles"]> } => Boolean(r.clubs && r.club_roles))
    .map((r) => ({
      club_id: r.club_id,
      club_name: r.clubs.name,
      role_id: r.role_id,
      role_name: r.club_roles.name,
      access_level: r.club_roles.access_level,
      logo_url: r.clubs.logo_url,
      theme_mode: r.clubs.theme_mode,
      theme_primary_color: r.clubs.theme_primary_color,
      theme_secondary_color: r.clubs.theme_secondary_color,
      theme_night_primary_color: r.clubs.theme_night_primary_color,
      theme_night_secondary_color: r.clubs.theme_night_secondary_color,
    }));
});

export async function getMembershipForClub(
  clubId: string,
): Promise<ClubMembership | null> {
  const memberships = await getMyMemberships();
  return memberships.find((m) => m.club_id === clubId) ?? null;
}
