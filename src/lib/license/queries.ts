import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { LicenseState, LicenseUsage } from "./types";

/**
 * Usage + effective state snapshot for a club. Returns null only if the club
 * has no licence row at all (legacy/transient) — callers treat that as active.
 * Cached per request so the layout and the Topbar share a single RPC call.
 */
export const getClubLicenseUsage = cache(
  async (clubId: string): Promise<LicenseUsage | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("club_license_usage", {
      p_club_id: clubId,
    });
    if (error || !data) return null;
    return data as LicenseUsage;
  },
);

/** Effective access state for a club; defaults to "active" when unprovisioned. */
export async function getClubLicenseState(clubId: string): Promise<LicenseState> {
  const usage = await getClubLicenseUsage(clubId);
  return usage?.state ?? "active";
}
