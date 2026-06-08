import { setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { requireUser } from "@/lib/auth/getUser";
import { resolveCurrentMembership } from "@/lib/club/context";
import { listClubSeasons, resolveCurrentSeasonLabel } from "@/lib/club/season";
import { getMyMemberships } from "@/lib/club/queries";
import { resolvePersona } from "@/lib/club/persona";
import { redirect } from "next/navigation";
import { clubThemeStyle } from "@/lib/club/theme";

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

  const [{ data: profile }, membership, memberships] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    resolveCurrentMembership(),
    getMyMemberships(),
  ]);

  const displayName = profile?.full_name?.trim() || user.email || "";
  const hasMembership = memberships.length > 0;

  // Per-team billing summary: count non-archived teams of the current club
  // and surface the trial state. Free-tier (no membership) shows nothing.
  let teamCount = 0;
  let currentSeason: string | null = null;
  let seasons: string[] = [];
  if (membership) {
    const [{ count }, season, seasonList] = await Promise.all([
      supabase
        .from("teams")
        .select("id", { head: true, count: "exact" })
        .eq("club_id", membership.club_id)
        .is("archived_at", null),
      resolveCurrentSeasonLabel(),
      listClubSeasons(supabase, membership.club_id),
    ]);
    teamCount = count ?? 0;
    currentSeason = season;
    seasons = seasonList;
  }

  return (
    <div
      className="flex min-h-screen flex-1 bg-[var(--club-page-bg)] dark:bg-zinc-950 print:bg-white"
      style={clubThemeStyle(membership)}
    >
      <div className="print:hidden">
        <Sidebar hasMembership={hasMembership} currentMembership={membership} />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="print:hidden">
          <Topbar
            userName={displayName}
            currentMembership={membership}
            memberships={memberships}
            teamCount={teamCount}
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
