import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/getUser";
import { canManageClub } from "@/lib/club/types";
import { loadClubSettingsData } from "./actions";
import { ClubSettings } from "@/components/settings/ClubSettings";

export default async function ClubSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { membership } = await requireMembership(locale);

  if (!canManageClub(membership.access_level)) {
    redirect(`/${locale}/dashboard`);
  }

  const data = await loadClubSettingsData();
  if (!data) redirect(`/${locale}/dashboard`);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Paramètres du club
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Gère les membres, les rôles et les invitations de{" "}
          <strong>{membership.club_name}</strong>.
        </p>
      </header>

      <ClubSettings data={data} />
    </div>
  );
}
