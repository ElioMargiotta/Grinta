import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LicenseState, LicenseStatus } from "@/lib/license/types";

export type ClubOverview = {
  club_id: string;
  name: string;
  created_at: string;
  archived_at: string | null;
  state: LicenseState;
  status: LicenseStatus | null;
  auto_renew: boolean | null;
  ends_at: string | null;
  quote_reference: string | null;
  teams: number;
  players: number;
  staff: number;
  max_teams: number | null;
  max_players: number | null;
  max_staff: number | null;
};

export type DashboardStats = {
  totalClubs: number;
  active: number;
  grace: number;
  locked: number;
  expiringSoon: number; // licences ending within 30 days (and not auto-renew)
  totalTeams: number;
  totalPlayers: number;
  totalStaff: number;
};

const EXPIRY_WINDOW_DAYS = 30;

export async function listClubsOverview(): Promise<ClubOverview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_clubs_overview");
  if (error || !data) return [];
  return data as ClubOverview[];
}

export function computeDashboardStats(clubs: ClubOverview[]): DashboardStats {
  const now = Date.now();
  const horizon = now + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const stats: DashboardStats = {
    totalClubs: clubs.length,
    active: 0,
    grace: 0,
    locked: 0,
    expiringSoon: 0,
    totalTeams: 0,
    totalPlayers: 0,
    totalStaff: 0,
  };
  for (const c of clubs) {
    if (c.state === "active") stats.active += 1;
    else if (c.state === "grace") stats.grace += 1;
    else stats.locked += 1;
    stats.totalTeams += c.teams;
    stats.totalPlayers += c.players;
    stats.totalStaff += c.staff;
    if (
      !c.auto_renew &&
      c.ends_at &&
      new Date(c.ends_at).getTime() <= horizon &&
      new Date(c.ends_at).getTime() >= now
    ) {
      stats.expiringSoon += 1;
    }
  }
  return stats;
}

export type ClubMemberRow = {
  user_id: string;
  full_name: string | null;
  role_name: string;
  access_level: string;
  joined_at: string | null;
  last_sign_in_at: string | null;
};

export type ClubActivity = {
  lastSignInAt: string | null; // most recent connection across all members
  activeLast30d: number; // members connected within 30 days
  neverConnected: number; // members who never signed in
};

export type LicenseEventRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ClubDetail = {
  club_id: string;
  name: string;
  created_at: string;
  archived_at: string | null;
  license: {
    status: LicenseStatus;
    state: LicenseState;
    auto_renew: boolean;
    starts_at: string | null;
    ends_at: string | null;
    grace_days: number;
    quote_reference: string | null;
    notes: string | null;
    max_teams: number | null;
    max_players: number | null;
    max_staff: number | null;
  } | null;
  usage: { teams: number; players: number; staff: number };
  members: ClubMemberRow[];
  activity: ClubActivity;
  events: LicenseEventRow[];
};

const ACTIVE_WINDOW_DAYS = 30;

function computeActivity(members: ClubMemberRow[]): ClubActivity {
  const horizon = Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  let lastSignInAt: string | null = null;
  let activeLast30d = 0;
  let neverConnected = 0;
  for (const m of members) {
    if (!m.last_sign_in_at) {
      neverConnected += 1;
      continue;
    }
    const ts = new Date(m.last_sign_in_at).getTime();
    if (ts >= horizon) activeLast30d += 1;
    if (!lastSignInAt || ts > new Date(lastSignInAt).getTime()) {
      lastSignInAt = m.last_sign_in_at;
    }
  }
  return { lastSignInAt, activeLast30d, neverConnected };
}

export async function getClubDetail(clubId: string): Promise<ClubDetail | null> {
  const supabase = await createClient();

  const [clubRes, licenseRes, usageRes, membersRes, eventsRes] = await Promise.all([
    supabase.from("clubs").select("id, name, created_at, archived_at").eq("id", clubId).maybeSingle(),
    supabase
      .from("club_licenses")
      .select(
        "status, auto_renew, starts_at, ends_at, grace_days, quote_reference, notes, max_teams, max_players, max_staff",
      )
      .eq("club_id", clubId)
      .maybeSingle(),
    supabase.rpc("club_license_usage", { p_club_id: clubId }),
    supabase.rpc("admin_club_members", { p_club_id: clubId }),
    supabase
      .from("license_events")
      .select("id, event_type, payload, created_at")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!clubRes.data) return null;

  const usage = (usageRes.data ?? null) as { state?: LicenseState } | null;
  const members = ((membersRes.data ?? []) as ClubMemberRow[]).map((m) => ({
    user_id: m.user_id,
    full_name: m.full_name ?? null,
    role_name: m.role_name ?? "—",
    access_level: m.access_level ?? "—",
    joined_at: m.joined_at ?? null,
    last_sign_in_at: m.last_sign_in_at ?? null,
  }));

  const lic = licenseRes.data as ClubDetail["license"];

  return {
    club_id: clubRes.data.id,
    name: clubRes.data.name,
    created_at: clubRes.data.created_at,
    archived_at: clubRes.data.archived_at ?? null,
    license: lic
      ? { ...lic, state: usage?.state ?? "active" }
      : null,
    usage: {
      teams: (usage as { teams?: number } | null)?.teams ?? 0,
      players: (usage as { players?: number } | null)?.players ?? 0,
      staff: (usage as { staff?: number } | null)?.staff ?? 0,
    },
    members,
    activity: computeActivity(members),
    events: (eventsRes.data ?? []) as LicenseEventRow[],
  };
}

export type DirectoryClub = {
  id: string;
  asf_number: string;
  name: string;
  association: string;
  canton: string | null;
  city: string | null;
  group_key: string | null;
  linked: boolean; // already onboarded as a tenant club
};

/**
 * Reference catalogue of official ASF clubs (admin-only), with a `linked` flag
 * marking entries already turned into a tenant so the picker can skip them.
 */
export async function listClubDirectory(): Promise<DirectoryClub[]> {
  const supabase = await createClient();

  const [dirRes, linkedRes] = await Promise.all([
    supabase
      .from("club_directory")
      .select("id, asf_number, name, association, canton, city, group_key")
      .order("association", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("clubs").select("directory_id").not("directory_id", "is", null),
  ]);

  if (dirRes.error || !dirRes.data) return [];
  const linkedIds = new Set(
    ((linkedRes.data ?? []) as { directory_id: string | null }[])
      .map((r) => r.directory_id)
      .filter((v): v is string => v !== null),
  );

  return (dirRes.data as Omit<DirectoryClub, "linked">[]).map((d) => ({
    ...d,
    linked: linkedIds.has(d.id),
  }));
}

export type PlatformAdminRow = {
  user_id: string;
  full_name: string | null;
  note: string | null;
  created_at: string;
};

export async function listPlatformAdmins(): Promise<PlatformAdminRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_admins")
    .select("user_id, note, created_at")
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as { user_id: string; note: string | null; created_at: string }[];
  if (rows.length === 0) return [];

  // platform_admins references auth.users, not profiles directly — resolve names
  // in a second query (profiles.id == auth.users.id).
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", rows.map((r) => r.user_id));
  const nameById = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]),
  );

  return rows.map((r) => ({
    user_id: r.user_id,
    note: r.note,
    created_at: r.created_at,
    full_name: nameById.get(r.user_id) ?? null,
  }));
}
