import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/getUser";
import { canManageClub } from "@/lib/club/types";
import { loadClubSettingsData } from "./actions";
import { ClubSettings } from "@/components/settings/ClubSettings";
import { ClubGroupSharing } from "@/components/settings/ClubGroupSharing";

export default async function ClubSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("settings.clubPage");
  const { membership } = await requireMembership(locale);

  if (!canManageClub(membership.access_level)) {
    redirect(`/${locale}/dashboard`);
  }

  const data = await loadClubSettingsData();
  if (!data) redirect(`/${locale}/dashboard`);
  const isGroup = data.clubIdentity.is_group;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">
          {t(isGroup ? "groupTitle" : "title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.rich(isGroup ? "groupSubtitle" : "subtitle", {
            club: membership.club_name,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </header>

      <ClubSettings data={data} />

      {!isGroup && data.groupShares.length > 0 && (
        <ClubGroupSharing groups={data.groupShares} />
      )}
    </div>
  );
}
