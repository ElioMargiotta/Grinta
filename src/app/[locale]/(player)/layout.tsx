import { setRequestLocale } from "next-intl/server";
import { PlayerSidebar } from "@/components/layout/PlayerSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { requirePersona } from "@/lib/auth/getUser";
import { getProfile } from "@/lib/auth/user";
import { resolveCurrentMembership } from "@/lib/club/context";
import { getMyMemberships } from "@/lib/club/queries";
import { clubThemeStyle } from "@/lib/club/theme";
import { getClubLicenseUsage } from "@/lib/license/queries";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { ClubAccentSync } from "@/components/layout/ClubAccentSync";
import {
  listRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/notifications/queries";

export default async function PlayerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user, persona } = await requirePersona(locale, "player");

  const [profile, membership, memberships, notifItems, notifUnread] =
    await Promise.all([
      getProfile(),
      resolveCurrentMembership(),
      getMyMemberships(),
      listRecentNotifications("player"),
      getUnreadNotificationCount("player"),
    ]);

  const displayName = profile?.full_name?.trim() || user.email || "";
  const licenseUsage = membership ? await getClubLicenseUsage(membership.club_id) : null;

  return (
    <div
      className="flex min-h-screen min-h-dvh flex-1 bg-[var(--club-page-bg-light)] dark:bg-[var(--club-page-bg-dark)] print:bg-white"
      style={clubThemeStyle(membership)}
    >
      <ClubAccentSync color={membership?.theme_primary_color ?? null} />
      <div className="print:hidden">
        <PlayerSidebar currentMembership={membership} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="print:hidden">
          <Topbar
            userName={displayName}
            currentMembership={membership}
            memberships={memberships}
            licenseUsage={licenseUsage}
            persona={persona}
            notifications={{
              userId: user.id,
              view: "player",
              items: notifItems,
              unread: notifUnread,
            }}
          />
        </div>
        <main className="flex-1 p-4 pb-24 md:p-5 lg:p-6 print:p-0">{children}</main>
      </div>
      <div className="print:hidden">
        <MobileNavigation mode="player" />
      </div>
    </div>
  );
}
