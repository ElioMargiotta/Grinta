import { setRequestLocale } from "next-intl/server";
import { PlayerSidebar } from "@/components/layout/PlayerSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { requirePersona } from "@/lib/auth/getUser";
import { resolveCurrentMembership } from "@/lib/club/context";
import { getMyMemberships } from "@/lib/club/queries";
import { clubThemeStyle } from "@/lib/club/theme";

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

  const [{ data: profile }, membership, memberships] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    resolveCurrentMembership(),
    getMyMemberships(),
  ]);

  const displayName = profile?.full_name?.trim() || user.email || "";

  return (
    <div
      className="flex min-h-screen flex-1 bg-[var(--club-page-bg)] dark:bg-zinc-950 print:bg-white"
      style={clubThemeStyle(membership)}
    >
      <div className="print:hidden">
        <PlayerSidebar currentMembership={membership} />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="print:hidden">
          <Topbar
            userName={displayName}
            currentMembership={membership}
            memberships={memberships}
            teamCount={0}
            persona={persona}
          />
        </div>
        <main className="flex-1 p-4 md:p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
