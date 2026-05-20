import { redirect } from "@/i18n/navigation";

// Migrated to the club-level contingent view (#40). The team-scoped roster
// lives at /contingent?team=<id>, which carries search, bulk actions, and
// CSV import. We keep this route as a permanent redirect so old bookmarks
// and emails still land in the right place.
export default async function PlayersPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  redirect({
    href: { pathname: "/contingent", query: { team: teamId } },
    locale,
  });
}
