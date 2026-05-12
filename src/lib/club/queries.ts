import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ClubMembership } from "./types";

type Row = {
  club_id: string;
  role_id: string;
  clubs: {
    name: string;
    subscription_status: ClubMembership["subscription_status"];
    trial_ends_at: string | null;
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
       clubs!inner(name, subscription_status, trial_ends_at),
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
      subscription_status: r.clubs.subscription_status,
      trial_ends_at: r.clubs.trial_ends_at,
    }));
});

export async function getMembershipForClub(
  clubId: string,
): Promise<ClubMembership | null> {
  const memberships = await getMyMemberships();
  return memberships.find((m) => m.club_id === clubId) ?? null;
}
