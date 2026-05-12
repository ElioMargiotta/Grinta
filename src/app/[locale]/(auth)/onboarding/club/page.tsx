import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/getUser";
import { getMyMemberships } from "@/lib/club/queries";
import { OnboardingClubForm } from "@/components/onboarding/OnboardingClubForm";

export default async function OnboardingClubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);

  // If the user already belongs to a club, send them to the dashboard.
  const memberships = await getMyMemberships();
  if (memberships.length > 0) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          Crée ton club
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Un club regroupe tes équipes, tes coachs et ta facturation. Tu peux
          inviter des membres dès qu&apos;il est créé.
        </p>
      </div>
      <OnboardingClubForm />
      <p className="text-xs text-zinc-500">
        14 jours d&apos;essai gratuit. Aucune carte requise pour commencer.
      </p>
    </div>
  );
}
