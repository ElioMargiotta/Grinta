import { setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { requireUser, isPlatformAdmin } from "@/lib/auth/getUser";
import { resolveCurrentMembership } from "@/lib/club/context";
import { listClubSeasons, resolveCurrentSeasonLabel } from "@/lib/club/season";
import { getMyMemberships } from "@/lib/club/queries";
import { resolvePersona } from "@/lib/club/persona";
import { redirect } from "next/navigation";
import { clubThemeStyle } from "@/lib/club/theme";
import { getClubLicenseUsage } from "@/lib/license/queries";
import type { LicenseUsage } from "@/lib/license/types";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireUser(locale);

  // Route group (app) is staff territory. If the user is in player mode (or
  // is purely a player), bounce to /me so the two views stay disjoint.
  const persona = await resolvePersona();
  if (persona && persona.active === "player") {
    redirect(`/${locale}/me`);
  }

  const [{ data: profile }, membership, memberships, admin] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    resolveCurrentMembership(),
    getMyMemberships(),
    isPlatformAdmin(),
  ]);

  const displayName = profile?.full_name?.trim() || user.email || "";
  const hasMembership = memberships.length > 0;

  // Licence gating + usage. A `locked` licence (suspended / expired past its
  // grace window) hides the club behind an info screen; `grace` keeps the data
  // visible but read-only (writes are also blocked at the DB level).
  let licenseUsage: LicenseUsage | null = null;
  let currentSeason: string | null = null;
  let seasons: string[] = [];
  if (membership) {
    const [usage, season, seasonList] = await Promise.all([
      getClubLicenseUsage(membership.club_id),
      resolveCurrentSeasonLabel(),
      listClubSeasons(supabase, membership.club_id),
    ]);
    licenseUsage = usage;
    currentSeason = season;
    seasons = seasonList;

    if (usage?.state === "locked") {
      redirect(`/${locale}/licence-inactive`);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-1 bg-[var(--club-page-bg)] dark:bg-zinc-950 print:bg-white"
      style={clubThemeStyle(membership)}
    >
      <div className="print:hidden">
        <Sidebar hasMembership={hasMembership} currentMembership={membership} isAdmin={admin} />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="print:hidden">
          <Topbar
            userName={displayName}
            currentMembership={membership}
            memberships={memberships}
            licenseUsage={licenseUsage}
            persona={persona}
            currentSeason={currentSeason}
            seasons={seasons}
          />
        </div>
        <main className="flex-1 p-4 md:p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
