import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/AuthShell";
import { MfaChallengeForm } from "@/components/auth/MfaChallengeForm";
import { createClient } from "@/lib/supabase/server";

export default async function MfaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Déjà passé en aal2 (ou aucun facteur requis) → rien à challenger ici.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal || aal.currentLevel === aal.nextLevel) {
    redirect(`/${locale}`);
  }

  return (
    <AuthShell>
      <MfaChallengeForm />
    </AuthShell>
  );
}
