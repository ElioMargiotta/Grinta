import { setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { requireMembership } from "@/lib/auth/getUser";
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
  const { supabase, user, membership } = await requireMembership(locale);

  const [{ data: profile }, memberships] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    getMyMemberships(),
  ]);

  const displayName = profile?.full_name?.trim() || user.email || "";

  return (
    <div className="flex min-h-screen flex-1 bg-zinc-50 dark:bg-zinc-950 print:bg-white">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="print:hidden">
          <Topbar
            userName={displayName}
            currentMembership={membership}
            memberships={memberships}
          />
        </div>
        <main className="flex-1 p-4 md:p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
