import { setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { requireUser } from "@/lib/auth/getUser";
import { resolveCurrentMembership } from "@/lib/club/context";
import { getMyMemberships } from "@/lib/club/queries";

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
  if (membership) {
    const { count } = await supabase
      .from("teams")
      .select("id", { head: true, count: "exact" })
      .eq("club_id", membership.club_id)
      .is("archived_at", null);
    teamCount = count ?? 0;
  }

  return (
    <div className="flex min-h-screen flex-1 bg-zinc-50 dark:bg-zinc-950 print:bg-white">
      <div className="print:hidden">
        <Sidebar hasMembership={hasMembership} />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="print:hidden">
          <Topbar
            userName={displayName}
            currentMembership={membership}
            memberships={memberships}
            teamCount={teamCount}
          />
        </div>
        <main className="flex-1 p-4 md:p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
