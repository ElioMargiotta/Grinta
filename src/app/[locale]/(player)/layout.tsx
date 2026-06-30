import { setRequestLocale } from "next-intl/server";
import { PlayerSidebar } from "@/components/layout/PlayerSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { requirePersona } from "@/lib/auth/getUser";
import { getProfile } from "@/lib/auth/user";
import { getMyMemberships } from "@/lib/club/queries";
import { clubThemeStyle } from "@/lib/club/theme";
import type { ClubMembership } from "@/lib/club/types";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { ClubAccentSync } from "@/components/layout/ClubAccentSync";
import {
  listRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/notifications/queries";
import { getLinkedPlayers, resolveActivePlayer } from "@/lib/player/profiles";
import { PlayerProfileSwitcher } from "@/components/player/PlayerProfileSwitcher";

export default async function PlayerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user, persona } = await requirePersona(locale, "player");

  const [profile, memberships, notifItems, notifUnread] =
    await Promise.all([
      getProfile(),
      getMyMemberships(),
      listRecentNotifications("player"),
      getUnreadNotificationCount("player"),
  ]);

  const displayName = profile?.full_name?.trim() || user.email || "";

  // Profils liés, séparés par sous-profil actif : Joueur = self, Parent = enfants.
  const linkedPlayers = await getLinkedPlayers();
  const visibleLinkedPlayers =
    persona.activeProfile === "parent"
      ? linkedPlayers.filter((p) => p.relation === "guardian")
      : linkedPlayers.filter((p) => p.relation === "self");
  const activePlayer = await resolveActivePlayer(
    visibleLinkedPlayers,
    persona.activeProfile === "parent" ? "guardian" : "self",
  );
  const switcherProfiles = visibleLinkedPlayers.map((p) => ({
    playerId: p.playerId,
    clubName: p.clubName,
    name: `${p.firstName} ${p.lastName}`.trim(),
    relation: p.relation,
    status: p.status,
  }));
  const guardianCount = linkedPlayers.filter((p) => p.relation === "guardian").length;
  const activeClub =
    activePlayer
      ? memberships.find((membership) => membership.club_id === activePlayer.clubId) ??
        null
      : null;
  let portalClub: ClubMembership | null =
    activeClub ??
    (activePlayer
      ? {
          club_id: activePlayer.clubId,
          club_name: activePlayer.clubName,
          role_id: activePlayer.relation,
          role_name: activePlayer.relation === "guardian" ? "Parent" : "Joueur",
          access_level: "team_readonly",
          logo_url: null,
          theme_mode: "day",
          theme_primary_color: "#18181b",
          theme_secondary_color: "#f4f4f5",
          theme_night_primary_color: "#f4f4f5",
          theme_night_secondary_color: "#18181b",
        }
      : null);

  if (activePlayer && !activeClub) {
    const { data: club } = await supabase
      .from("clubs")
      .select(
        "id, name, logo_url, theme_mode, theme_primary_color, theme_secondary_color, theme_night_primary_color, theme_night_secondary_color",
      )
      .eq("id", activePlayer.clubId)
      .maybeSingle();

    if (club) {
      portalClub = {
        club_id: club.id as string,
        club_name: (club.name as string | null) ?? activePlayer.clubName,
        role_id: activePlayer.relation,
        role_name: activePlayer.relation === "guardian" ? "Parent" : "Joueur",
        access_level: "team_readonly",
        logo_url: (club.logo_url as string | null) ?? null,
        theme_mode: (club.theme_mode as ClubMembership["theme_mode"]) ?? "day",
        theme_primary_color:
          (club.theme_primary_color as string | null) ?? "#18181b",
        theme_secondary_color:
          (club.theme_secondary_color as string | null) ?? "#f4f4f5",
        theme_night_primary_color:
          (club.theme_night_primary_color as string | null) ?? "#f4f4f5",
        theme_night_secondary_color:
          (club.theme_night_secondary_color as string | null) ?? "#18181b",
      };
    }
  }

  return (
    <div
      className="flex min-h-screen min-h-dvh flex-1 bg-[var(--club-page-bg-light)] dark:bg-[var(--club-page-bg-dark)] print:bg-white"
      style={clubThemeStyle(portalClub)}
    >
      <ClubAccentSync color={portalClub?.theme_primary_color ?? null} />
      <div className="print:hidden">
        <PlayerSidebar
          currentMembership={portalClub}
          activeProfile={persona.activeProfile}
          guardianCount={guardianCount}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="print:hidden">
          <Topbar
            userName={displayName}
            currentMembership={portalClub}
            memberships={memberships}
            licenseUsage={null}
            persona={persona}
            notifications={{
              userId: user.id,
              view: "player",
              items: notifItems,
              unread: notifUnread,
            }}
          />
        </div>
        {switcherProfiles.length > 1 && activePlayer && (
          <div className="border-b border-[var(--club-line)] px-4 py-2 print:hidden md:px-5 lg:px-6">
            <PlayerProfileSwitcher
              profiles={switcherProfiles}
              activeId={activePlayer.playerId}
            />
          </div>
        )}
        <main className="flex-1 p-4 pb-24 md:p-5 lg:p-6 print:p-0">{children}</main>
      </div>
      <div className="print:hidden">
        <MobileNavigation
          mode="player"
          activeProfile={persona.activeProfile}
          guardianCount={guardianCount}
        />
      </div>
    </div>
  );
}
